# Design: Tag 기능

## 1. 개요

Plan 문서 기반 상세 설계서. Rally의 각 엔티티(note, todo, image, pdf, csv, canvas, folder)에 태그를 부여하여 카테고리를 분류하는 기능.

**참조**: `docs/01-plan/features/tag.plan.md`

---

## 2. DB 스키마

### 2.1 tags 테이블

**파일**: `src/main/db/schema/tag.ts`

```typescript
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export type TaggableEntityType =
  | 'note'
  | 'todo'
  | 'image'
  | 'pdf'
  | 'csv'
  | 'canvas'
  | 'folder'

export const TAGGABLE_ENTITY_TYPES: TaggableEntityType[] = [
  'canvas',
  'csv',
  'folder',
  'image',
  'note',
  'pdf',
  'todo'
]

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [unique().on(t.workspaceId, t.name)]
)
```

**설계 근거**:

| 항목 | 설명 |
|------|------|
| `workspaceId` FK | workspace 삭제 시 cascade + workspace 단위 태그 관리 |
| `unique(workspaceId, name)` | 같은 workspace 내 태그 이름 중복 방지 (anonymous `unique()` — 프로젝트 컨벤션) |
| `description` nullable | 의도적 선택 — 다른 엔티티는 `.notNull().default('')`를 쓰지만, tag description은 대부분 미사용이므로 nullable이 더 적합 |
| `createdAt` only | tag는 수정 시 별도 updatedAt 불필요 (name/color만 변경, 이력 추적 불필요) |

### 2.2 item_tags 테이블

**파일**: `src/main/db/schema/item-tag.ts`

```typescript
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { tags } from './tag'

export const itemTags = sqliteTable(
  'item_tags',
  {
    id: text('id').primaryKey(),
    itemType: text('item_type').notNull(),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    unique().on(t.itemType, t.tagId, t.itemId),
    index('idx_item_tags_item').on(t.itemType, t.itemId),
    index('idx_item_tags_tag').on(t.tagId)
  ]
)
```

**설계 근거**:

| 항목 | 설명 |
|------|------|
| `id` PK | nanoid PK (entity-link는 composite PK 사용하지만, tag는 개별 ID가 프론트엔드 리스트 key로 유용) |
| `unique(itemType, tagId, itemId)` | 동일 아이템에 같은 태그 중복 할당 방지, `onConflictDoNothing` 활용 (anonymous `unique()`) |
| `tagId` FK cascade | 태그 삭제 시 연결 자동 정리 |
| `itemId` FK 없음 | 다양한 테이블 참조이므로 로직으로 처리 (entity-link 패턴 동일) |
| `createdAt` only | junction 테이블 — attach/detach만 수행, update 없음 |
| `idx_item_tags_item` | 아이템별 태그 조회 (detail 페이지 진입 시) |
| `idx_item_tags_tag` | 태그별 아이템 조회 (list filter 시) |

### 2.3 스키마 등록

**파일**: `src/main/db/schema/index.ts`

```typescript
import { tags } from './tag'
import { itemTags } from './item-tag'

export {
  // ...기존 exports
  tags,
  itemTags
}
```

---

## 3. Backend

### 3.1 Repository — tag

**파일**: `src/main/repositories/tag.ts`

```typescript
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { tags } from '../db/schema'

export type Tag = typeof tags.$inferSelect
export type TagInsert = typeof tags.$inferInsert

export const tagRepository = {
  findByWorkspaceId(workspaceId: string): Tag[] {
    return db.select().from(tags).where(eq(tags.workspaceId, workspaceId)).all()
  },

  findById(id: string): Tag | undefined {
    return db.select().from(tags).where(eq(tags.id, id)).get()
  },

  findByName(workspaceId: string, name: string): Tag | undefined {
    return db
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, name)))
      .get()
  },

  create(data: TagInsert): Tag {
    return db.insert(tags).values(data).returning().get()
  },

  update(id: string, data: Partial<Pick<Tag, 'name' | 'color' | 'description'>>): Tag | undefined {
    return db.update(tags).set(data).where(eq(tags.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(tags).where(eq(tags.id, id)).run()
  }
}
```

### 3.2 Repository — item-tag

**파일**: `src/main/repositories/item-tag.ts`

```typescript
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { itemTags } from '../db/schema'

export type ItemTag = typeof itemTags.$inferSelect
export type ItemTagInsert = typeof itemTags.$inferInsert

export const itemTagRepository = {
  findByItem(itemType: string, itemId: string): ItemTag[] {
    return db
      .select()
      .from(itemTags)
      .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
      .all()
  },

  findByTag(tagId: string): ItemTag[] {
    return db.select().from(itemTags).where(eq(itemTags.tagId, tagId)).all()
  },

  attach(data: ItemTagInsert): void {
    db.insert(itemTags).values(data).onConflictDoNothing().run()
  },

  detach(itemType: string, tagId: string, itemId: string): void {
    db.delete(itemTags)
      .where(
        and(
          eq(itemTags.itemType, itemType),
          eq(itemTags.tagId, tagId),
          eq(itemTags.itemId, itemId)
        )
      )
      .run()
  },

  detachAllByItem(itemType: string, itemId: string): void {
    db.delete(itemTags)
      .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
      .run()
  },

  detachAllByTag(tagId: string): void {
    db.delete(itemTags).where(eq(itemTags.tagId, tagId)).run()
  }
}
```

### 3.3 Service — tag

**파일**: `src/main/services/tag.ts`

```typescript
import { nanoid } from 'nanoid'
import { ConflictError, NotFoundError } from '../lib/errors'
import { tagRepository } from '../repositories/tag'
import { workspaceRepository } from '../repositories/workspace'

export interface TagItem {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date
}

function toTagItem(row: {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date | number
}): TagItem {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
  }
}

export interface CreateTagInput {
  name: string
  color: string
  description?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
  description?: string | null
}

export const tagService = {
  getAll(workspaceId: string): TagItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    return tagRepository.findByWorkspaceId(workspaceId).map(toTagItem)
  },

  create(workspaceId: string, input: CreateTagInput): TagItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const existing = tagRepository.findByName(workspaceId, input.name)
    if (existing) throw new ConflictError(`Tag already exists: ${input.name}`)

    const row = tagRepository.create({
      id: nanoid(),
      workspaceId,
      name: input.name,
      color: input.color,
      description: input.description ?? null,
      createdAt: new Date()
    })

    return toTagItem(row)
  },

  update(id: string, input: UpdateTagInput): TagItem {
    const tag = tagRepository.findById(id)
    if (!tag) throw new NotFoundError(`Tag not found: ${id}`)

    if (input.name && input.name !== tag.name) {
      const existing = tagRepository.findByName(tag.workspaceId, input.name)
      if (existing) throw new ConflictError(`Tag already exists: ${input.name}`)
    }

    const row = tagRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.description !== undefined && { description: input.description })
    })
    if (!row) throw new NotFoundError(`Tag not found: ${id}`)

    return toTagItem(row)
  },

  remove(id: string): void {
    const tag = tagRepository.findById(id)
    if (!tag) throw new NotFoundError(`Tag not found: ${id}`)

    // item_tags는 tagId FK cascade로 자동 삭제
    tagRepository.delete(id)
  }
}
```

### 3.4 Service — item-tag

**파일**: `src/main/services/item-tag.ts`

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { tagRepository } from '../repositories/tag'
import { itemTagRepository } from '../repositories/item-tag'
import type { TaggableEntityType } from '../db/schema/tag'
import type { TagItem } from './tag'

function toTagItem(row: {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date | number
}): TagItem {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
  }
}

export const itemTagService = {
  getTagsByItem(itemType: TaggableEntityType, itemId: string): TagItem[] {
    const rows = itemTagRepository.findByItem(itemType, itemId)
    const result: TagItem[] = []

    for (const row of rows) {
      const tag = tagRepository.findById(row.tagId)
      if (tag) result.push(toTagItem(tag))
    }

    return result
  },

  getItemIdsByTag(tagId: string, itemType: TaggableEntityType): string[] {
    return itemTagRepository
      .findByTag(tagId)
      .filter((row) => row.itemType === itemType)
      .map((row) => row.itemId)
  },

  attach(itemType: TaggableEntityType, tagId: string, itemId: string): void {
    const tag = tagRepository.findById(tagId)
    if (!tag) throw new NotFoundError(`Tag not found: ${tagId}`)

    itemTagRepository.attach({
      id: nanoid(),
      itemType,
      tagId,
      itemId,
      createdAt: new Date()
    })
  },

  detach(itemType: TaggableEntityType, tagId: string, itemId: string): void {
    itemTagRepository.detach(itemType, tagId, itemId)
  },

  removeByItem(itemType: TaggableEntityType, itemId: string): void {
    itemTagRepository.detachAllByItem(itemType, itemId)
  }
}
```

### 3.5 IPC Handlers

**파일**: `src/main/ipc/tag.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { tagService } from '../services/tag'
import type { CreateTagInput, UpdateTagInput } from '../services/tag'

export function registerTagHandlers(): void {
  ipcMain.handle(
    'tag:getAll',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => tagService.getAll(workspaceId))
  )

  ipcMain.handle(
    'tag:create',
    (_: IpcMainInvokeEvent, workspaceId: string, input: CreateTagInput): IpcResponse =>
      handle(() => tagService.create(workspaceId, input))
  )

  ipcMain.handle(
    'tag:update',
    (_: IpcMainInvokeEvent, id: string, input: UpdateTagInput): IpcResponse =>
      handle(() => tagService.update(id, input))
  )

  ipcMain.handle(
    'tag:remove',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => tagService.remove(id))
  )
}
```

**파일**: `src/main/ipc/item-tag.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { itemTagService } from '../services/item-tag'
import type { TaggableEntityType } from '../db/schema/tag'

export function registerItemTagHandlers(): void {
  ipcMain.handle(
    'itemTag:getTagsByItem',
    (_: IpcMainInvokeEvent, itemType: TaggableEntityType, itemId: string): IpcResponse =>
      handle(() => itemTagService.getTagsByItem(itemType, itemId))
  )

  ipcMain.handle(
    'itemTag:attach',
    (
      _: IpcMainInvokeEvent,
      itemType: TaggableEntityType,
      tagId: string,
      itemId: string
    ): IpcResponse => handle(() => itemTagService.attach(itemType, tagId, itemId))
  )

  ipcMain.handle(
    'itemTag:detach',
    (
      _: IpcMainInvokeEvent,
      itemType: TaggableEntityType,
      tagId: string,
      itemId: string
    ): IpcResponse => handle(() => itemTagService.detach(itemType, tagId, itemId))
  )

  ipcMain.handle(
    'itemTag:getItemIdsByTag',
    (_: IpcMainInvokeEvent, tagId: string, itemType: TaggableEntityType): IpcResponse =>
      handle(() => itemTagService.getItemIdsByTag(tagId, itemType))
  )
}
```

### 3.6 핸들러 등록

**파일**: `src/main/index.ts` — `app.whenReady()` 내부에 추가:

```typescript
import { registerTagHandlers } from './ipc/tag'
import { registerItemTagHandlers } from './ipc/item-tag'

// app.whenReady() 내부
registerTagHandlers()
registerItemTagHandlers()
```

### 3.7 Preload Bridge

**파일**: `src/preload/index.ts` — `api` 객체에 추가:

```typescript
tag: {
  getAll: (workspaceId: string) => ipcRenderer.invoke('tag:getAll', workspaceId),
  create: (workspaceId: string, input: { name: string; color: string; description?: string }) =>
    ipcRenderer.invoke('tag:create', workspaceId, input),
  update: (id: string, input: { name?: string; color?: string; description?: string | null }) =>
    ipcRenderer.invoke('tag:update', id, input),
  remove: (id: string) => ipcRenderer.invoke('tag:remove', id)
},
itemTag: {
  getTagsByItem: (itemType: string, itemId: string) =>
    ipcRenderer.invoke('itemTag:getTagsByItem', itemType, itemId),
  attach: (itemType: string, tagId: string, itemId: string) =>
    ipcRenderer.invoke('itemTag:attach', itemType, tagId, itemId),
  detach: (itemType: string, tagId: string, itemId: string) =>
    ipcRenderer.invoke('itemTag:detach', itemType, tagId, itemId),
  getItemIdsByTag: (tagId: string, itemType: string) =>
    ipcRenderer.invoke('itemTag:getItemIdsByTag', tagId, itemType)
}
```

### 3.8 Preload 타입 선언

**파일**: `src/preload/index.d.ts` — 추가:

```typescript
import type { TagItem, CreateTagInput, UpdateTagInput } from '../main/services/tag'
import type { TaggableEntityType } from '../main/db/schema/tag'

interface TagAPI {
  getAll: (workspaceId: string) => Promise<IpcResponse<TagItem[]>>
  create: (workspaceId: string, input: CreateTagInput) => Promise<IpcResponse<TagItem>>
  update: (id: string, input: UpdateTagInput) => Promise<IpcResponse<TagItem>>
  remove: (id: string) => Promise<IpcResponse<void>>
}

interface ItemTagAPI {
  getTagsByItem: (itemType: TaggableEntityType, itemId: string) => Promise<IpcResponse<TagItem[]>>
  attach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
  detach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
  getItemIdsByTag: (
    tagId: string,
    itemType: TaggableEntityType
  ) => Promise<IpcResponse<string[]>>
}

// API 인터페이스에 추가
interface API {
  // ...기존 항목
  tag: TagAPI
  itemTag: ItemTagAPI
}
```

### 3.9 기존 서비스 연동 — remove 시 item_tag 정리

각 엔티티의 `remove` 메서드에서 cleanup 추가. 기존 cleanup 순서: `entityLinkService` → `canvasNodeRepository` → `repository.delete`.
`itemTagService.removeByItem()` 호출을 `entityLinkService` 직후에 삽입.

```typescript
import { itemTagService } from './item-tag'

// ── noteService.remove(workspaceId, noteId) 내부 ──
// 기존: noteImageService.deleteAllImages → fs.unlinkSync → entityLink → canvasNode → DB delete
entityLinkService.removeAllLinks('note', noteId)
itemTagService.removeByItem('note', noteId)           // ← 추가
canvasNodeRepository.deleteByRef('note', noteId)
noteRepository.delete(noteId)

// ── todoService.remove(todoId) 내부 ──
// 주의: 시그니처가 remove(todoId) — workspaceId 없음
// 기존: findAllDescendantIds → reminder → entityLink → canvasNode → DB delete
const subtodoIds = todoRepository.findAllDescendantIds(todoId)
reminderService.removeByEntities('todo', [todoId, ...subtodoIds])
entityLinkService.removeAllLinksForTodos([todoId, ...subtodoIds])
for (const tid of [todoId, ...subtodoIds]) {           // ← 추가 (루프 — subtodo 수가 적으므로 충분)
  itemTagService.removeByItem('todo', tid)
}
canvasNodeRepository.deleteByRef('todo', todoId)
for (const subId of subtodoIds) {
  canvasNodeRepository.deleteByRef('todo', subId)
}
todoRepository.delete(todoId)

// ── imageFileService.remove(workspaceId, imageId) 내부 ──
entityLinkService.removeAllLinks('image', imageId)
itemTagService.removeByItem('image', imageId)          // ← 추가
canvasNodeRepository.deleteByRef('image', imageId)
imageFileRepository.delete(imageId)

// ── pdfFileService.remove(workspaceId, pdfId) 내부 ──
entityLinkService.removeAllLinks('pdf', pdfId)
itemTagService.removeByItem('pdf', pdfId)              // ← 추가
canvasNodeRepository.deleteByRef('pdf', pdfId)
pdfFileRepository.delete(pdfId)

// ── csvFileService.remove(workspaceId, csvId) 내부 ──
entityLinkService.removeAllLinks('csv', csvId)
itemTagService.removeByItem('csv', csvId)              // ← 추가
canvasNodeRepository.deleteByRef('csv', csvId)
csvFileRepository.delete(csvId)

// ── canvasService.remove(canvasId) 내부 ──
// 주의: 현재 entityLink cleanup이 없음 (Phase 2 TODO 상태)
// entityLinkService.removeAllLinks('canvas', canvasId)  // TODO — 기존 누락
itemTagService.removeByItem('canvas', canvasId)        // ← 추가
canvasRepository.delete(canvasId)

// ── folderService.remove(workspaceId, folderId) 내부 ──
// 주의: folder는 bulkDeleteByPrefix로 하위 폴더 cascade 삭제
// 하위 note는 folderId가 SET NULL되며 DB에 남음 (물리 파일만 삭제)
// → 하위 folder/note의 item_tag는 정리되지 않음 (orphan 허용 — entity-link과 동일 패턴)
itemTagService.removeByItem('folder', folderId)        // ← 추가 (대상 folder 본인만 정리)
fs.rmSync(absPath, { recursive: true, force: true })
folderRepository.bulkDeleteByPrefix(workspaceId, folder.relativePath)
```

---

## 4. Frontend

### 4.1 FSD 구조

```
src/renderer/src/
├── entities/tag/
│   ├── model/
│   │   ├── types.ts              ← TagItem, TaggableEntityType, CreateTagInput, UpdateTagInput
│   │   └── queries.ts            ← React Query hooks
│   ├── ui/
│   │   └── TagBadge.tsx          ← 개별 태그 표시 컴포넌트
│   └── index.ts                  ← barrel export
│
└── features/tag/
    └── manage-tag/
        ├── ui/
        │   ├── TagList.tsx           ← 아이템에 연결된 태그 목록 + 추가/제거 (mutation 소유)
        │   ├── TagCreateDialog.tsx   ← 태그 생성 다이얼로그
        │   ├── TagUpdateDialog.tsx   ← 태그 수정/삭제 다이얼로그
        │   ├── TagPicker.tsx         ← 태그 선택 팝오버 (lifted state)
        │   └── TagColorPicker.tsx    ← 프리셋 색상 선택 컴포넌트
        └── index.ts                  ← barrel export
```

### 4.2 entities/tag — 타입 & React Query

**파일**: `src/renderer/src/entities/tag/model/types.ts`

```typescript
export type TaggableEntityType =
  | 'note'
  | 'todo'
  | 'image'
  | 'pdf'
  | 'csv'
  | 'canvas'
  | 'folder'

export interface TagItem {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date
}

export interface CreateTagInput {
  name: string
  color: string
  description?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
  description?: string | null
}
```

**파일**: `src/renderer/src/entities/tag/model/queries.ts`

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { TagItem, TaggableEntityType, CreateTagInput, UpdateTagInput } from './types'

export const TAG_KEY = 'tag'
export const ITEM_TAG_KEY = 'itemTag'

// ── 태그 CRUD ──

export function useTags(workspaceId: string | undefined): UseQueryResult<TagItem[]> {
  return useQuery({
    queryKey: [TAG_KEY, workspaceId],
    queryFn: async (): Promise<TagItem[]> => {
      const res: IpcResponse<TagItem[]> = await window.api.tag.getAll(workspaceId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useItemTags(
  itemType: TaggableEntityType,
  itemId: string | undefined
): UseQueryResult<TagItem[]> {
  return useQuery({
    queryKey: [ITEM_TAG_KEY, itemType, itemId],
    queryFn: async (): Promise<TagItem[]> => {
      const res: IpcResponse<TagItem[]> = await window.api.itemTag.getTagsByItem(itemType, itemId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!itemId
  })
}

export function useItemIdsByTag(
  tagId: string | undefined,
  itemType: TaggableEntityType
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: [ITEM_TAG_KEY, 'byTag', tagId, itemType],
    queryFn: async (): Promise<string[]> => {
      const res: IpcResponse<string[]> = await window.api.itemTag.getItemIdsByTag(tagId!, itemType)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!tagId
  })
}

export function useCreateTag(): UseMutationResult<
  TagItem | undefined,
  Error,
  { workspaceId: string; input: CreateTagInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, input }) => {
      const res: IpcResponse<TagItem> = await window.api.tag.create(workspaceId, input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TAG_KEY, workspaceId] })
    }
  })
}

export function useUpdateTag(): UseMutationResult<
  TagItem | undefined,
  Error,
  { id: string; input: UpdateTagInput; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }) => {
      const res: IpcResponse<TagItem> = await window.api.tag.update(id, input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TAG_KEY, workspaceId] })
    }
  })
}

export function useRemoveTag(): UseMutationResult<
  void,
  Error,
  { id: string; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const res: IpcResponse<void> = await window.api.tag.remove(id)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TAG_KEY, workspaceId] })
      queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY] })
    }
  })
}

// ── 아이템-태그 연결 ──

export function useAttachTag(): UseMutationResult<
  void,
  Error,
  { itemType: TaggableEntityType; tagId: string; itemId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemType, tagId, itemId }) => {
      const res: IpcResponse<void> = await window.api.itemTag.attach(itemType, tagId, itemId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { itemType, itemId }) => {
      queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY, itemType, itemId] })
    }
  })
}

export function useDetachTag(): UseMutationResult<
  void,
  Error,
  { itemType: TaggableEntityType; tagId: string; itemId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemType, tagId, itemId }) => {
      const res: IpcResponse<void> = await window.api.itemTag.detach(itemType, tagId, itemId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { itemType, itemId }) => {
      queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY, itemType, itemId] })
    }
  })
}
```

**파일**: `src/renderer/src/entities/tag/ui/TagBadge.tsx`

```tsx
import { X } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import type { TagItem } from '../model/types'

interface TagBadgeProps {
  tag: TagItem
  onRemove?: () => void
  className?: string
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
        className
      )}
      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
    >
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
      <span className="truncate max-w-[120px]">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          className="ml-0.5 hover:opacity-70"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
```

**파일**: `src/renderer/src/entities/tag/index.ts`

```typescript
export type { TagItem, TaggableEntityType, CreateTagInput, UpdateTagInput } from './model/types'
export {
  TAG_KEY,
  ITEM_TAG_KEY,
  useTags,
  useItemTags,
  useItemIdsByTag,
  useCreateTag,
  useUpdateTag,
  useRemoveTag,
  useAttachTag,
  useDetachTag
} from './model/queries'
export { TagBadge } from './ui/TagBadge'
```

### 4.3 features/tag/manage-tag — UI 컴포넌트

**아키텍처**: TagList가 모든 mutation을 소유하고 자식 컴포넌트에 콜백/상태를 내려주는 **Lifted State** 패턴.

**TagColorPicker** — `features/tag/manage-tag/ui/TagColorPicker.tsx`

```tsx
// 12개 프리셋 색상 그리드 (grid-cols-6)
// Check 아이콘으로 선택 피드백
const PRESET_COLORS = [
  '#a3c4f5', '#93c5fd', '#6ee7b7', '#86efac',
  '#fde68a', '#fcd34d', '#fca5a5', '#f9a8d4',
  '#c4b5fd', '#a78bfa', '#94a3b8', '#78716c'
]

interface Props {
  value: string
  onChange: (color: string) => void
}
```

**TagCreateDialog** — `features/tag/manage-tag/ui/TagCreateDialog.tsx`

```tsx
// zod + react-hook-form 패턴
// TagColorPicker를 사용하여 색상 선택
// Mutation은 소유하지 않음 — onSubmit 콜백으로 위임
const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50),
  color: z.string().min(1)
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onSubmit: (data: { name: string; color: string }) => void
}

// form fields: name (Input, autoFocus), color (TagColorPicker, 기본값 '#a3c4f5')
```

**TagUpdateDialog** — `features/tag/manage-tag/ui/TagUpdateDialog.tsx`

```tsx
// TagCreateDialog와 유사 구조 + description 필드 + 삭제 버튼
// Mutation은 소유하지 않음 — onSubmit, onRemove 콜백으로 위임
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: TagItem
  isPending: boolean
  onSubmit: (data: { name?: string; color?: string; description?: string | null }) => void
  onRemove: () => void
}
```

**TagPicker** — `features/tag/manage-tag/ui/TagPicker.tsx`

```tsx
// Popover 기반 태그 선택기 (Lifted State — 데이터 조회 없음)
// - allTags, attachedTagIds를 props로 받음
// - Check 아이콘으로 attach/detach 상태 표시
// - 검색 필터 (Input)
// - 하단 "새 태그 만들기" 버튼 → onCreateClick 콜백
// - Plus 아이콘 트리거 내장

interface Props {
  allTags: TagItem[]
  attachedTagIds: Set<string>
  onToggle: (tag: TagItem) => void
  onCreateClick: () => void
}
```

**TagList** — `features/tag/manage-tag/ui/TagList.tsx`

```tsx
// 모든 mutation과 상태를 소유하는 컨테이너 컴포넌트
// - useTags, useItemTags로 조회
// - useCreateTag, useUpdateTag, useRemoveTag, useAttachTag, useDetachTag mutation
// - TagBadge + TagPicker + TagCreateDialog + TagUpdateDialog 조합
// - "태그" 라벨 표시

interface Props {
  workspaceId: string
  itemType: TaggableEntityType
  itemId: string
}

// flex items-center gap-1 flex-wrap 레이아웃
// "태그" 라벨 → TagBadge 목록 → TagPicker(+버튼)
// TagBadge 클릭 → TagUpdateDialog 열기
// TagBadge onRemove → detachTag
```

**파일**: `features/tag/manage-tag/index.ts`

```typescript
export { TagList } from './ui/TagList'
```

### 4.4 각 기능별 통합 위치

**TabHeader `footer` prop** — TagList를 TabHeader의 `footer` 슬롯에 렌더링. Fragment 감싸기 불필요.

```tsx
// TabHeader에 footer prop 추가 (shared/ui/tab-header.tsx)
interface TabHeaderProps {
  // ...기존 props
  footer?: React.ReactNode  // ← 추가
}

// editable/non-editable 모드 모두에서 렌더
{footer && <div className="mt-2">{footer}</div>}
```

**통합 방식 A — Header 컴포넌트 위임 페이지**

```tsx
// 예시: NoteHeader — TabHeader의 footer prop 사용
<TabHeader
  editable
  title={note?.title ?? ''}
  buttons={<LinkedEntityPopoverButton ... />}
  footer={<TagList workspaceId={workspaceId} itemType="note" itemId={noteId} />}
  onTitleChange={...}
/>
```

적용 대상:

| Header 컴포넌트 | 파일 | itemType |
|-----------------|------|----------|
| `NoteHeader` | `features/note/edit-note/ui/NoteHeader.tsx` | `'note'` |
| `ImageHeader` | `features/image/view-image/ui/ImageHeader.tsx` | `'image'` |
| `PdfHeader` | `features/pdf/view-pdf/ui/PdfHeader.tsx` | `'pdf'` |
| `CsvHeader` | `features/csv/edit-csv/ui/CsvHeader.tsx` | `'csv'` |

**통합 방식 B — TabHeader 직접 사용 페이지**

```tsx
// 예시: TodoDetailPage — TabHeader footer prop 사용
<TabHeader
  editable
  title={...}
  buttons={...}
  footer={<TagList workspaceId={workspaceId!} itemType="todo" itemId={todo.id} />}
/>
```

적용 대상:

| 페이지 | 파일 | itemType |
|--------|------|----------|
| `TodoDetailPage` | `pages/todo-detail/ui/TodoDetailPage.tsx` | `'todo'` |
| `CanvasDetailPage` | `pages/canvas-detail/ui/CanvasDetailPage.tsx` | `'canvas'` |

**통합 방식 C — Folder (FolderTree context menu)** (향후 구현)

**통합 방식 D — CreateTodoDialog (pending tag)** (향후 구현)

### 4.5 List Filter

기존 `tabSearchParams` 패턴을 따라 각 list 화면에 태그 필터 추가.

**필터 흐름**:
1. list 상단에 태그 필터 드롭다운 (workspace 태그 목록 — `useTagsByWorkspace`)
2. 선택 시 `navigateTab(tabId, { searchParams: { tagId } })` — 탭 전환 시 필터 유지
3. `useItemIdsByTag(tagId, itemType)` → 해당 태그의 아이템 ID 목록 조회
4. 기존 목록과 교집합 필터링

**복수 태그 선택**: v1은 단일 tagId 필터만 지원. AND/OR 복합 필터는 향후 확장.

---

## 5. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | DB Schema | `schema/tag.ts`, `schema/item-tag.ts`, `schema/index.ts` + `db:generate` + `db:migrate` |
| 2 | Repository | `repositories/tag.ts`, `repositories/item-tag.ts` |
| 3 | Service + 기존 연동 | `services/tag.ts`, `services/item-tag.ts` + 7개 기존 서비스 remove 수정 |
| 4 | IPC + Preload | `ipc/tag.ts`, `ipc/item-tag.ts`, `main/index.ts`, `preload/index.ts`, `preload/index.d.ts` |
| 5 | entities/tag | `entities/tag/model/types.ts`, `queries.ts`, `ui/TagBadge.tsx`, `index.ts` |
| 6 | features/tag | `TagList.tsx`, `TagCreateDialog.tsx`, `TagUpdateDialog.tsx`, `TagPicker.tsx` |
| 7 | 각 기능 통합 | 방식 A: 4개 Header 수정, 방식 B: 2개 Page 수정, 방식 C: FolderTree, 방식 D: CreateTodoDialog |
| 8 | List Filter | `getItemIdsByTag` IPC + 각 list 페이지 필터 UI |

---

## 6. 참고 사항

- `entity-link` 패턴을 참고하되 tag는 단방향 (아이템 → 태그) 연결이므로 normalize 불필요
- tag 삭제 → item_tags FK cascade 자동 정리
- item 삭제 → service 로직에서 `itemTagService.removeByItem()` 호출
- `canvasService.remove`는 현재 entityLink cleanup이 없음 (Phase 2 TODO) — itemTag cleanup만 먼저 추가
- folder는 `bulkDeleteByPrefix`로 하위 폴더 cascade 삭제 — 하위 folder/note의 item_tag orphan은 entity-link과 동일하게 조회 시 무시 패턴 적용
- tag 자체는 `LinkableEntityType`에 포함하지 않음 (entity-link 대상 아님)
- todo subtodo의 item_tag 정리는 루프 방식 사용 (subtodo 수가 적어 N+1 무시 가능)
- List Filter는 v1 단일 tagId 필터, 복수 태그 AND/OR은 향후 확장
