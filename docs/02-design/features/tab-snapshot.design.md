# Design: Tab Snapshot (탭 스냅샷)

> Plan 참조: `docs/01-plan/features/tab-snapshot.plan.md`

---

## 1. DB Schema

### `src/main/db/schema/tab-snapshot.ts`

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const tabSnapshots = sqliteTable('tab_snapshots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  tabsJson: text('tabs_json').notNull(),
  panesJson: text('panes_json').notNull(),
  layoutJson: text('layout_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
```

### `src/main/db/schema/index.ts` 수정

```typescript
import { workspaces } from './workspace'
import { tabSessions } from './tab-session'
import { tabSnapshots } from './tab-snapshot'

export { workspaces, tabSessions, tabSnapshots }
```

---

## 2. Repository

### `src/main/repositories/tab-snapshot.ts`

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { tabSnapshots } from '../db/schema'

export type TabSnapshot = typeof tabSnapshots.$inferSelect
export type TabSnapshotInsert = typeof tabSnapshots.$inferInsert
export type TabSnapshotUpdate = Partial<Pick<TabSnapshot, 'name' | 'description' | 'updatedAt'>>

export const tabSnapshotRepository = {
  findByWorkspaceId(workspaceId: string): TabSnapshot[] {
    return db.select().from(tabSnapshots).where(eq(tabSnapshots.workspaceId, workspaceId)).all()
  },

  findById(id: string): TabSnapshot | undefined {
    return db.select().from(tabSnapshots).where(eq(tabSnapshots.id, id)).get()
  },

  create(data: TabSnapshotInsert): TabSnapshot {
    return db.insert(tabSnapshots).values(data).returning().get()
  },

  update(id: string, data: TabSnapshotUpdate): TabSnapshot | undefined {
    return db.update(tabSnapshots).set(data).where(eq(tabSnapshots.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(tabSnapshots).where(eq(tabSnapshots.id, id)).run()
  }
}
```

---

## 3. Service

### `src/main/services/tab-snapshot.ts`

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { tabSnapshotRepository } from '../repositories/tab-snapshot'
import type { TabSnapshotUpdate } from '../repositories/tab-snapshot'

export const tabSnapshotService = {
  getByWorkspaceId(workspaceId: string) {
    return tabSnapshotRepository.findByWorkspaceId(workspaceId)
  },

  create(data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) {
    if (!data.name.trim()) throw new ValidationError('Snapshot name is required')
    if (!data.tabsJson || !data.panesJson || !data.layoutJson) {
      throw new ValidationError('Invalid snapshot data')
    }
    return tabSnapshotRepository.create({
      id: nanoid(),
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      workspaceId: data.workspaceId,
      tabsJson: data.tabsJson,
      panesJson: data.panesJson,
      layoutJson: data.layoutJson,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  },

  update(id: string, data: TabSnapshotUpdate) {
    const snapshot = tabSnapshotRepository.findById(id)
    if (!snapshot) throw new NotFoundError(`TabSnapshot not found: ${id}`)
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Snapshot name is required')
    }
    return tabSnapshotRepository.update(id, {
      ...data,
      updatedAt: new Date()
    })
  },

  delete(id: string) {
    const snapshot = tabSnapshotRepository.findById(id)
    if (!snapshot) throw new NotFoundError(`TabSnapshot not found: ${id}`)
    tabSnapshotRepository.delete(id)
  }
}
```

---

## 4. IPC Handler

### `src/main/ipc/tab-snapshot.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { tabSnapshotService } from '../services/tab-snapshot'

type CreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

type UpdateInput = {
  name?: string
  description?: string
}

export function registerTabSnapshotHandlers(): void {
  ipcMain.handle(
    'tabSnapshot:getByWorkspaceId',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => tabSnapshotService.getByWorkspaceId(workspaceId))
  )

  ipcMain.handle(
    'tabSnapshot:create',
    (_: IpcMainInvokeEvent, data: CreateInput): IpcResponse =>
      handle(() => tabSnapshotService.create(data))
  )

  ipcMain.handle(
    'tabSnapshot:update',
    (_: IpcMainInvokeEvent, id: string, data: UpdateInput): IpcResponse =>
      handle(() => tabSnapshotService.update(id, data))
  )

  ipcMain.handle(
    'tabSnapshot:delete',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => tabSnapshotService.delete(id))
  )
}
```

### `src/main/index.ts` 수정

```typescript
import { registerTabSnapshotHandlers } from './ipc/tab-snapshot'

// app.whenReady() 내부:
registerTabSnapshotHandlers()
```

---

## 5. Preload Bridge

### `src/preload/index.ts` 수정

```typescript
// api 객체에 추가:
tabSnapshot: {
  getByWorkspaceId: (workspaceId: string) =>
    ipcRenderer.invoke('tabSnapshot:getByWorkspaceId', workspaceId),
  create: (data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) => ipcRenderer.invoke('tabSnapshot:create', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    ipcRenderer.invoke('tabSnapshot:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('tabSnapshot:delete', id)
}
```

### `src/preload/index.d.ts` 수정

```typescript
import type { TabSnapshot } from '../main/repositories/tab-snapshot'

interface TabSnapshotAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSnapshot[]>>
  create: (data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) => Promise<IpcResponse<TabSnapshot>>
  update: (
    id: string,
    data: { name?: string; description?: string }
  ) => Promise<IpcResponse<TabSnapshot>>
  delete: (id: string) => Promise<IpcResponse<void>>
}

// interface API에 추가:
interface API {
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
}
```

---

## 6. Renderer — Entity

### `src/renderer/src/entities/tab-snapshot/model/types.ts`

```typescript
import { z } from 'zod'

export const TabSnapshotSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '스냅샷 이름은 필수입니다'),
  description: z.string().nullable(),
  workspaceId: z.string(),
  tabsJson: z.string(),
  panesJson: z.string(),
  layoutJson: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
})

export type TabSnapshot = z.infer<typeof TabSnapshotSchema>
```

### `src/renderer/src/entities/tab-snapshot/api/queries.ts`

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { IpcResponse } from '@shared/types/ipc'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { TabSnapshot } from '../model/types'

const QUERY_KEY = 'tabSnapshots'

type CreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

type UpdateInput = { id: string; name?: string; description?: string }

export function useTabSnapshots(workspaceId: string): UseQueryResult<TabSnapshot[]> {
  return useQuery({
    queryKey: [QUERY_KEY, workspaceId],
    queryFn: async (): Promise<TabSnapshot[]> => {
      const res: IpcResponse<TabSnapshot[]> =
        await window.api.tabSnapshot.getByWorkspaceId(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateTabSnapshot(): UseMutationResult<
  TabSnapshot | undefined,
  Error,
  CreateInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateInput): Promise<TabSnapshot | undefined> => {
      const res: IpcResponse<TabSnapshot> = await window.api.tabSnapshot.create(data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, data?.workspaceId] })
    }
  })
}

export function useUpdateTabSnapshot(): UseMutationResult<
  TabSnapshot | undefined,
  Error,
  UpdateInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description
    }: UpdateInput): Promise<TabSnapshot | undefined> => {
      const res: IpcResponse<TabSnapshot> = await window.api.tabSnapshot.update(id, {
        name,
        description
      })
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, data?.workspaceId] })
    }
  })
}

export function useDeleteTabSnapshot(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res: IpcResponse = await window.api.tabSnapshot.delete(id)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    }
  })
}
```

### `src/renderer/src/entities/tab-snapshot/index.ts`

```typescript
export type { TabSnapshot } from './model/types'
export { TabSnapshotSchema } from './model/types'
export {
  useTabSnapshots,
  useCreateTabSnapshot,
  useUpdateTabSnapshot,
  useDeleteTabSnapshot
} from './api/queries'
```

---

## 7. Renderer — Feature UI

### 파일 구조

```
src/renderer/src/features/tab-snapshot/manage-tab-snapshot/
├── index.ts
└── ui/
    ├── TabSnapshotSection.tsx   ← 사이드바 섹션 전체 (접기/펼치기 + 목록 + 저장 버튼)
    ├── TabSnapshotItem.tsx      ← 스냅샷 아이템 (컨텍스트 메뉴)
    ├── SaveSnapshotDialog.tsx   ← 현재 탭 저장 Dialog
    ├── EditSnapshotDialog.tsx   ← 이름/설명 수정 Dialog
    └── DeleteSnapshotDialog.tsx ← 삭제 확인 Dialog
```

---

### `TabSnapshotSection.tsx`

```typescript
import { JSX, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/collapsible'
import { Button } from '@shared/ui/button'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu
} from '@shared/ui/sidebar'
import { useTabSnapshots } from '@entities/tab-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'
import { TabSnapshotItem } from './TabSnapshotItem'
import { SaveSnapshotDialog } from './SaveSnapshotDialog'
import { EditSnapshotDialog } from './EditSnapshotDialog'
import { DeleteSnapshotDialog } from './DeleteSnapshotDialog'

interface Props {
  workspaceId: string
}

export function TabSnapshotSection({ workspaceId }: Props): JSX.Element {
  const [isOpen, setIsOpen] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TabSnapshot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TabSnapshot | null>(null)

  const { data: snapshots = [] } = useTabSnapshots(workspaceId)

  return (
    <>
      <SidebarGroup>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <span>탭 스냅샷</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
          </SidebarGroupLabel>

          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                <div className="max-h-[400px] overflow-y-auto">
                  {snapshots.map((snapshot) => (
                    <TabSnapshotItem
                      key={snapshot.id}
                      snapshot={snapshot}
                      onEdit={() => setEditTarget(snapshot)}
                      onDelete={() => setDeleteTarget(snapshot)}
                    />
                  ))}
                </div>
              </SidebarMenu>

              <div className="sticky bottom-0 px-2 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSaveDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  현재 탭 저장
                </Button>
              </div>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      <SaveSnapshotDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        workspaceId={workspaceId}
      />
      <EditSnapshotDialog
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null) }}
        snapshot={editTarget}
      />
      <DeleteSnapshotDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        snapshot={deleteTarget}
      />
    </>
  )
}
```

---

### `TabSnapshotItem.tsx`

```typescript
import { JSX } from 'react'
import { Camera } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@shared/ui/sidebar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@shared/ui/context-menu'
import type { TabSnapshot } from '@entities/tab-snapshot'

interface Props {
  snapshot: TabSnapshot
  onEdit: () => void
  onDelete: () => void
}

export function TabSnapshotItem({ snapshot, onEdit, onDelete }: Props): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <SidebarMenuItem>
          <SidebarMenuButton className="cursor-pointer" tooltip={snapshot.name}>
            <Camera className="h-4 w-4 shrink-0" />
            <span className="truncate">{snapshot.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>수정</ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

---

### `SaveSnapshotDialog.tsx`

```typescript
import { JSX } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useCreateTabSnapshot } from '@entities/tab-snapshot'
import { useTabStore } from '@/features/tap-system/manage-tab-system'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  description: z.string().optional()
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function SaveSnapshotDialog({ open, onOpenChange, workspaceId }: Props): JSX.Element {
  const { mutate: createSnapshot, isPending } = useCreateTabSnapshot()

  // 현재 탭 상태 직접 읽기
  const tabs = useTabStore.getState().tabs
  const panes = useTabStore.getState().panes
  const layout = useTabStore.getState().layout

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' }
  })

  const handleSubmit = (values: FormValues): void => {
    createSnapshot(
      {
        name: values.name,
        description: values.description || undefined,
        workspaceId,
        tabsJson: JSON.stringify(tabs),
        panesJson: JSON.stringify(panes),
        layoutJson: JSON.stringify(layout)
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          form.reset()
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>현재 탭 저장</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input placeholder="스냅샷 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>설명 (선택)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="스냅샷 설명" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### `EditSnapshotDialog.tsx`

```typescript
import { JSX, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useUpdateTabSnapshot } from '@entities/tab-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  description: z.string().optional()
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: TabSnapshot | null
}

export function EditSnapshotDialog({ open, onOpenChange, snapshot }: Props): JSX.Element {
  const { mutate: updateSnapshot, isPending } = useUpdateTabSnapshot()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: snapshot?.name ?? '', description: snapshot?.description ?? '' }
  })

  useEffect(() => {
    if (snapshot) {
      form.reset({ name: snapshot.name, description: snapshot.description ?? '' })
    }
  }, [snapshot, form])

  const handleSubmit = (values: FormValues): void => {
    if (!snapshot) return
    updateSnapshot(
      {
        id: snapshot.id,
        name: values.name,
        description: values.description || undefined
      },
      {
        onSuccess: () => onOpenChange(false)
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>스냅샷 수정</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input placeholder="스냅샷 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>설명 (선택)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="스냅샷 설명" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### `DeleteSnapshotDialog.tsx`

```typescript
import { JSX } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@shared/ui/alert-dialog'
import { useDeleteTabSnapshot } from '@entities/tab-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: TabSnapshot | null
}

export function DeleteSnapshotDialog({ open, onOpenChange, snapshot }: Props): JSX.Element {
  const { mutate: deleteSnapshot, isPending } = useDeleteTabSnapshot()

  const handleDelete = (): void => {
    if (!snapshot) return
    deleteSnapshot(snapshot.id, {
      onSuccess: () => onOpenChange(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>스냅샷 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{`"${snapshot?.name}"`}</span> 스냅샷을 삭제할까요?
            <br />이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? '삭제 중...' : '삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

### `index.ts` (feature barrel)

```typescript
export { TabSnapshotSection } from './ui/TabSnapshotSection'
```

---

## 8. Sidebar 연결

### `src/renderer/src/app/layout/MainSidebar.tsx` 수정

```typescript
// import 추가:
import { TabSnapshotSection } from '@/features/tab-snapshot/manage-tab-snapshot'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

// MainSidebar 함수 내부에 추가:
const currentWorkspaceId = useCurrentWorkspaceStore((state) => state.currentWorkspaceId)

// JSX — 기존 빈 "탭 스냅샷" SidebarGroup 교체:
{currentWorkspaceId && <TabSnapshotSection workspaceId={currentWorkspaceId} />}
```

> 기존 `<SidebarGroup><SidebarGroupLabel>탭 스냅샷</SidebarGroupLabel>...</SidebarGroup>` 블록 전체를 위 코드로 교체

---

## 9. 마이그레이션

```bash
npm run db:generate   # 새 migration 파일 생성
# db:migrate는 Electron 앱 시작 시 자동 적용 (runMigrations)
```

---

## 10. 파일 목록 요약

| 파일                                                                                     | 작업                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------- |
| `src/main/db/schema/tab-snapshot.ts`                                                     | 신규 생성                          |
| `src/main/db/schema/index.ts`                                                            | tabSnapshots export 추가           |
| `src/main/repositories/tab-snapshot.ts`                                                  | 신규 생성                          |
| `src/main/services/tab-snapshot.ts`                                                      | 신규 생성                          |
| `src/main/ipc/tab-snapshot.ts`                                                           | 신규 생성                          |
| `src/main/index.ts`                                                                      | registerTabSnapshotHandlers() 추가 |
| `src/preload/index.ts`                                                                   | tabSnapshot API 추가               |
| `src/preload/index.d.ts`                                                                 | TabSnapshotAPI 타입 추가           |
| `src/renderer/src/entities/tab-snapshot/model/types.ts`                                  | 신규 생성                          |
| `src/renderer/src/entities/tab-snapshot/api/queries.ts`                                  | 신규 생성                          |
| `src/renderer/src/entities/tab-snapshot/index.ts`                                        | 신규 생성                          |
| `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotSection.tsx`   | 신규 생성                          |
| `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotItem.tsx`      | 신규 생성                          |
| `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/SaveSnapshotDialog.tsx`   | 신규 생성                          |
| `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/EditSnapshotDialog.tsx`   | 신규 생성                          |
| `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/DeleteSnapshotDialog.tsx` | 신규 생성                          |
| `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/index.ts`                    | 신규 생성                          |
| `src/renderer/src/app/layout/MainSidebar.tsx`                                            | TabSnapshotSection 연결            |
