# Codebase Refactoring Design Document

## Reference
- Plan: `docs/01-plan/features/codebase-refactoring.plan.md` (v3)

---

## Step 0: Bug Fixes (BUG-1, BUG-2, BUG-3)

### BUG-1: Note own-write-tracker Set → Map

**Before:**
```typescript
// src/renderer/src/entities/note/model/own-write-tracker.ts
const pendingWrites = new Set<string>()
export function markAsOwnWrite(noteId: string): void {
  pendingWrites.add(noteId)
  setTimeout(() => pendingWrites.delete(noteId), 2000)
}
```

**After:**
```typescript
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
export function markAsOwnWrite(noteId: string): void {
  const prev = pendingWrites.get(noteId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(noteId), 2000)
  pendingWrites.set(noteId, timer)
}
export function isOwnWrite(noteId: string): boolean {
  return pendingWrites.has(noteId)
}
```

**변경 파일**: `src/renderer/src/entities/note/model/own-write-tracker.ts`
**사이드 이펙트**: 없음. API 시그니처 동일. 동작 개선만 발생.

### BUG-2: Note useRenameNote에 markAsOwnWrite 추가

**변경 파일**: `src/renderer/src/entities/note/api/queries.ts`
**변경 내용**: `useRenameNote` mutation의 `onMutate`에 `markAsOwnWrite(noteId)` 추가
```typescript
// useRenameNote의 onMutate
onMutate: ({ workspaceId, noteId }) => {
  markWorkspaceOwnWrite(workspaceId)
  markAsOwnWrite(noteId) // 추가
}
```
**import 추가**: `import { markAsOwnWrite } from '../model/own-write-tracker'`

### BUG-3: Note entity barrel export에 isOwnWrite + EVENT 상수 추가

**변경 파일**: `src/renderer/src/entities/note/index.ts`
**변경 내용**: 누락된 export 2개 추가 (csv-file의 barrel export 패턴과 일치시킴)
```typescript
export { isOwnWrite } from './model/own-write-tracker'
export { NOTE_EXTERNAL_CHANGED_EVENT } from './model/use-note-watcher'
```

---

## Step 1: fs-utils Generic Scanner

### 신규 파일: 없음 (기존 파일 내 리팩토링)

### 변경 파일: `src/main/lib/fs-utils.ts`

### 설계

통합된 `FileEntry` 인터페이스와 2개의 제네릭 내부 함수를 생성하고, 기존 8개 함수를 wrapper로 변환.

```typescript
// --- 통합 인터페이스 ---
export interface FileEntry {
  name: string
  relativePath: string
}

// 기존 타입별 인터페이스는 FileEntry의 alias로 유지 (호출부 변경 없음)
export type MdFileEntry = FileEntry
export type CsvFileEntry = FileEntry
export type PdfFileEntry = FileEntry
export type ImageFileEntry = FileEntry

// --- 제네릭 내부 함수 (export하지 않음) ---
function readFilesRecursive(
  absBase: string,
  parentRel: string,
  matcher: (name: string) => boolean
): FileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: FileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      result.push(...readFilesRecursive(absBase, rel, matcher))
    } else if (entry.isFile() && matcher(entry.name)) {
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

async function readFilesRecursiveAsync(
  absBase: string,
  parentRel: string,
  matcher: (name: string) => boolean
): Promise<FileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: FileEntry[] = []
  const subdirPromises: Promise<FileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      subdirPromises.push(readFilesRecursiveAsync(absBase, rel, matcher))
    } else if (entry.isFile() && matcher(entry.name)) {
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  const subResults = await Promise.all(subdirPromises)
  return result.concat(...subResults)
}

// --- 기존 export 함수 (wrapper) ---
export const readMdFilesRecursive = (abs: string, rel: string): MdFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.md'))

export const readMdFilesRecursiveAsync = (abs: string, rel: string): Promise<MdFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.md'))

export const readCsvFilesRecursive = (abs: string, rel: string): CsvFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.csv'))

export const readCsvFilesRecursiveAsync = (abs: string, rel: string): Promise<CsvFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.csv'))

export const readPdfFilesRecursive = (abs: string, rel: string): PdfFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.pdf'))

export const readPdfFilesRecursiveAsync = (abs: string, rel: string): Promise<PdfFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.pdf'))

export const readImageFilesRecursive = (abs: string, rel: string): ImageFileEntry[] =>
  readFilesRecursive(abs, rel, isImageFile)

export const readImageFilesRecursiveAsync = (abs: string, rel: string): Promise<ImageFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, isImageFile)

// isImageFile, IMAGE_EXTENSIONS, resolveNameConflict — 변경 없음
```

### 호출부 영향: 없음
- 함수명, 시그니처, 반환 타입 모두 동일
- `MdFileEntry` 등 타입도 `FileEntry` alias로 호환

---

## Step 2: Service 공통 유틸 추출

### 신규 파일: `src/main/lib/path-utils.ts`

```typescript
/** Windows '\' → '/' 정규화 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** relativePath에서 부모 디렉토리 relative path 추출 */
export function parentRelPath(relativePath: string): string | null {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('/')
}
```

### toXxxNode 매퍼: 각 서비스에 유지 (추출하지 않음)

> **결정 근거**: CSV의 `columnWidths`, 향후 타입별 필드 추가 가능성을 고려하면 공통 `toFileNode` 매퍼는 타입 안전성을 해침. 각 서비스의 `toXxxNode`은 그대로 유지하여 타입별 정확한 매핑 보장.

### 변경 파일: 4개 서비스

각 서비스에서:
1. `normalizePath`, `parentRelPath` 로컬 함수 삭제
2. `import { normalizePath, parentRelPath } from '../lib/path-utils'` 추가
3. `toXxxNode` 함수는 **변경 없이 유지**

### 호출부 영향: 없음
- path 유틸만 import 경로 변경, 동작 동일

---

## Step 3: Repository Factory

### 신규 파일: `src/main/repositories/create-file-repository.ts`

```typescript
import { and, eq, inArray, like, type InferSelectModel } from 'drizzle-orm'
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { db } from '../db'

/**
 * 파일 타입 repository 공통 메서드 팩토리
 * update()는 타입별 필드 차이(CSV의 columnWidths)가 있으므로 제외
 */
export function createFileRepository<
  T extends SQLiteTableWithColumns<any> & {
    id: any
    workspaceId: any
    relativePath: any
  }
>(table: T, tableName: string) {
  type Row = InferSelectModel<T>
  type Insert = T['$inferInsert']

  return {
    findByWorkspaceId(workspaceId: string): Row[] {
      return db.select().from(table).where(eq(table.workspaceId, workspaceId)).all() as Row[]
    },

    findById(id: string): Row | undefined {
      return db.select().from(table).where(eq(table.id, id)).get() as Row | undefined
    },

    findByRelativePath(workspaceId: string, relativePath: string): Row | undefined {
      return db
        .select()
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), eq(table.relativePath, relativePath)))
        .get() as Row | undefined
    },

    create(data: Insert): Row {
      return db.insert(table).values(data as any).returning().get() as Row
    },

    createMany(items: Insert[]): void {
      if (items.length === 0) return
      const CHUNK = 99
      for (let i = 0; i < items.length; i += CHUNK) {
        db.insert(table)
          .values(items.slice(i, i + CHUNK) as any)
          .onConflictDoNothing()
          .run()
      }
    },

    deleteOrphans(workspaceId: string, existingPaths: string[]): void {
      if (existingPaths.length === 0) {
        db.delete(table).where(eq(table.workspaceId, workspaceId)).run()
        return
      }
      const existingSet = new Set(existingPaths)
      const dbRows = db
        .select({ id: table.id, relativePath: table.relativePath })
        .from(table)
        .where(eq(table.workspaceId, workspaceId))
        .all()
      const orphanIds = dbRows
        .filter((r: any) => !existingSet.has(r.relativePath))
        .map((r: any) => r.id)
      if (orphanIds.length === 0) return
      const CHUNK = 900
      for (let i = 0; i < orphanIds.length; i += CHUNK) {
        db.delete(table)
          .where(inArray(table.id, orphanIds.slice(i, i + CHUNK)))
          .run()
      }
    },

    bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
      db.delete(table)
        .where(
          and(eq(table.workspaceId, workspaceId), like(table.relativePath, `${prefix}/%`))
        )
        .run()
    },

    bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
      const now = Date.now()
      db.$client.transaction(() => {
        db.$client
          .prepare(
            `UPDATE ${tableName}
             SET relative_path = ? || substr(relative_path, ?),
                 updated_at = ?
             WHERE workspace_id = ?
               AND (relative_path = ? OR relative_path LIKE ?)`
          )
          .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
      })()
    },

    reindexSiblings(workspaceId: string, orderedIds: string[]): void {
      const now = Date.now()
      const stmt = db.$client.prepare(
        `UPDATE ${tableName} SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
      )
      db.$client.transaction(() => {
        for (let i = 0; i < orderedIds.length; i++) {
          stmt.run(i, now, workspaceId, orderedIds[i])
        }
      })()
    },

    findByIds(ids: string[]): Row[] {
      if (ids.length === 0) return []
      const CHUNK = 900
      const results: Row[] = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK)
        results.push(
          ...(db.select().from(table).where(inArray(table.id, chunk)).all() as Row[])
        )
      }
      return results
    },

    delete(id: string): void {
      db.delete(table).where(eq(table.id, id)).run()
    },
  }
}
```

### 변경 파일: 4개 repository

**note.ts (리팩토링 후):**
```typescript
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { notes } from '../db/schema'
import { createFileRepository } from './create-file-repository'

export type Note = typeof notes.$inferSelect
export type NoteInsert = typeof notes.$inferInsert

const base = createFileRepository(notes, 'notes')

export const noteRepository = {
  ...base,
  update(
    id: string,
    data: Partial<
      Pick<Note, 'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'>
    >
  ): Note | undefined {
    return db.update(notes).set(data).where(eq(notes.id, id)).returning().get()
  },
}
```

**csv-file.ts (리팩토링 후):**
```typescript
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { csvFiles } from '../db/schema'
import { createFileRepository } from './create-file-repository'

export type CsvFile = typeof csvFiles.$inferSelect
export type CsvFileInsert = typeof csvFiles.$inferInsert

const base = createFileRepository(csvFiles, 'csv_files')

export const csvFileRepository = {
  ...base,
  update(
    id: string,
    data: Partial<
      Pick<CsvFile, 'relativePath' | 'title' | 'description' | 'preview' | 'columnWidths' | 'folderId' | 'order' | 'updatedAt'>
    >
  ): CsvFile | undefined {
    return db.update(csvFiles).set(data).where(eq(csvFiles.id, id)).returning().get()
  },
}
```

**pdf-file.ts, image-file.ts:** note.ts와 동일 패턴 (update 필드에 columnWidths 없음)

### 호출부 영향: 없음
- repository 객체의 메서드 시그니처 완전 동일
- `noteRepository.findByWorkspaceId(...)` 등 모든 호출 그대로 동작
- `leaf-reindex.ts`는 repository를 직접 import하므로 변경 없음

### 주의사항
- Drizzle의 테이블 타입 제네릭이 복잡할 수 있음 → 구현 시 `as any` 캐스팅이 필요할 수 있으나, 외부 API 타입은 정확히 유지
- `tableName` 문자열은 실제 SQLite 테이블명과 일치해야 함 (notes, csv_files, pdf_files, image_files)

---

## Step 4: Renderer 중복 통합

### 4-1. Own-Write Tracker Factory

**신규 파일**: `src/renderer/src/shared/lib/create-own-write-tracker.ts`

```typescript
/** 자체 저장 추적기 팩토리 — watcher 이벤트와 구분하기 위해 사용 */
export function createOwnWriteTracker(timeoutMs = 2000) {
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

  return {
    markAsOwnWrite(id: string): void {
      const prev = pendingWrites.get(id)
      if (prev) clearTimeout(prev)
      const timer = setTimeout(() => pendingWrites.delete(id), timeoutMs)
      pendingWrites.set(id, timer)
    },
    isOwnWrite(id: string): boolean {
      return pendingWrites.has(id)
    },
  }
}
```

**변경 파일**: 4개 entity own-write-tracker

각 파일을 다음으로 교체:
```typescript
// src/renderer/src/entities/note/model/own-write-tracker.ts
import { createOwnWriteTracker } from '@shared/lib/create-own-write-tracker'
const tracker = createOwnWriteTracker()
export const markAsOwnWrite = tracker.markAsOwnWrite
export const isOwnWrite = tracker.isOwnWrite
```

CSV, PDF, Image도 동일. `workspace-own-write.ts`는 워크스페이스 단위 로직이므로 **변경하지 않음**.

### 4-2. File Watcher Hook Factory

**신규 파일**: `src/renderer/src/shared/hooks/use-file-watcher.ts`

```typescript
import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'

interface FileWatcherConfig {
  /** window.api[type].onChanged 메서드 */
  onChanged: (cb: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
  /** React Query 캐시 키 prefix (예: 'note') */
  queryKeyPrefix: string
  /** 토스트 아이콘 컴포넌트 */
  icon: React.ComponentType<{ className?: string }>
  /** 커스텀 이벤트 이름 */
  externalChangedEvent: string
  /** entity ID 필드명 (CustomEvent detail) */
  idField: string
  /** isOwnWrite 함수 */
  isOwnWrite: (id: string) => boolean
}

export function useFileWatcher(config: FileWatcherConfig): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)

    const unsub = config.onChanged((workspaceId, changedRelPaths) => {
      queryClient.invalidateQueries({
        queryKey: [config.queryKeyPrefix, 'workspace', workspaceId],
      })

      const items = queryClient.getQueryData<Array<{ id: string; relativePath: string; title: string }>>(
        [config.queryKeyPrefix, 'workspace', workspaceId]
      )

      if (items && changedRelPaths.length > 0) {
        const externalItems = items.filter(
          (item) =>
            changedRelPaths.includes(item.relativePath) &&
            !config.isOwnWrite(item.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )

        if (readyRef.current && externalItems.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalItems.map((item) =>
                createElement(
                  'li',
                  { key: item.id, className: 'flex items-center gap-1.5' },
                  createElement(config.icon, { className: 'size-3.5 shrink-0' }),
                  item.title
                )
              )
            ),
          })
        }

        externalItems.forEach((item) => {
          queryClient
            .refetchQueries({
              queryKey: [config.queryKeyPrefix, 'content', item.id],
            })
            .then(() => {
              window.dispatchEvent(
                new CustomEvent(config.externalChangedEvent, {
                  detail: { [config.idField]: item.id },
                })
              )
            })
        })
      }
    })

    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [queryClient])
}
```

**변경 파일**: 4개 entity watcher hook

```typescript
// src/renderer/src/entities/note/model/use-note-watcher.ts
import { FileText } from 'lucide-react'
import { useFileWatcher } from '@shared/hooks/use-file-watcher'
import { isOwnWrite } from './own-write-tracker'

export const NOTE_EXTERNAL_CHANGED_EVENT = 'note:external-changed'

export function useNoteWatcher(): void {
  useFileWatcher({
    onChanged: window.api.note.onChanged,
    queryKeyPrefix: 'note',
    icon: FileText,
    externalChangedEvent: NOTE_EXTERNAL_CHANGED_EVENT,
    idField: 'noteId',
    isOwnWrite,
  })
}
```

CSV, PDF, Image도 동일 패턴 (아이콘, 이벤트명, queryKeyPrefix, idField만 다름).

### 4-3. Context Menu 통합

**신규 파일**: `src/renderer/src/features/folder/manage-folder/ui/FileContextMenu.tsx`

```tsx
import { JSX } from 'react'
import { Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@shared/ui/context-menu'

interface Props {
  children: React.ReactNode
  onDelete: () => void
}

export function FileContextMenu({ children, onDelete }: Props): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

**삭제 파일**: `NoteContextMenu.tsx`, `CsvContextMenu.tsx`, `PdfContextMenu.tsx`, `ImageContextMenu.tsx`
**변경 파일**: `FolderTree.tsx` — import를 `FileContextMenu`로 변경

---

## Step 5: Preload onChanged Helper

### 변경 파일: `src/preload/index.ts`

```typescript
// 헬퍼 함수 (파일 상단에 추가)
function createOnChangedListener(channel: string) {
  return (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      workspaceId: string,
      changedRelPaths: string[]
    ): void => callback(workspaceId, changedRelPaths)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

// 사용
const api = {
  note: {
    // ... 기존 메서드
    onChanged: createOnChangedListener('note:changed'),
  },
  csv: {
    // ... 기존 메서드
    onChanged: createOnChangedListener('csv:changed'),
  },
  // pdf, image, folder 동일
  // entity-link는 시그니처가 다르므로 제외 (파라미터 없음)
}
```

**entity-link 제외 이유**: `entity-link:changed`의 콜백은 `() => void` (파라미터 없음)이므로 같은 헬퍼 사용 불가.

---

## Step 6: Workspace Watcher Refactoring

### 변경 파일: `src/main/services/workspace-watcher.ts`

### Config 타입 정의

```typescript
interface FileTypeConfig {
  /** 확장자 매칭 함수 */
  matchExtension: (fileName: string) => boolean
  /** 확장자 제거한 제목 추출 */
  extractTitle: (fileName: string) => string
  /** Repository 참조 */
  repository: {
    findByRelativePath(workspaceId: string, relativePath: string): any
    create(data: any): any
    delete(id: string): void
    bulkDeleteByPrefix(workspaceId: string, prefix: string): void
    bulkUpdatePathPrefix(workspaceId: string, old: string, new_: string): void
    findByWorkspaceId(workspaceId: string): any[]
    createMany(items: any[]): void
  }
  /** IPC push 채널명 */
  channelName: string
  /** entity-link에서 사용할 타입 문자열 */
  entityType: 'note' | 'csv' | 'pdf' | 'image'
  /** 이벤트 필터 (Image의 .images/ 제외 등) */
  skipFilter?: (relativePath: string) => boolean
}

const fileTypeConfigs: FileTypeConfig[] = [
  {
    matchExtension: (n) => n.endsWith('.md'),
    extractTitle: (n) => path.basename(n, '.md'),
    repository: noteRepository,
    channelName: 'note:changed',
    entityType: 'note',
  },
  {
    matchExtension: (n) => n.endsWith('.csv'),
    extractTitle: (n) => path.basename(n, '.csv'),
    repository: csvFileRepository,
    channelName: 'csv:changed',
    entityType: 'csv',
  },
  {
    matchExtension: (n) => n.endsWith('.pdf'),
    extractTitle: (n) => path.basename(n, '.pdf'),
    repository: pdfFileRepository,
    channelName: 'pdf:changed',
    entityType: 'pdf',
  },
  {
    matchExtension: isImageFile,
    extractTitle: (n) => path.basename(n, path.extname(n)),
    repository: imageFileRepository,
    channelName: 'image:changed',
    entityType: 'image',
    skipFilter: (rel) => rel.startsWith('.images/') || rel.includes('/.images/'),
  },
]
```

### 추출할 메서드

**1. `processFileTypeEvents(events, config)` — applyEvents의 Steps 3-14 통합**

각 파일 타입의 rename/create/delete 처리를 제네릭화:
- rename 감지: delete+create 쌍 매칭 (동일 디렉토리, 동일 basename)
- standalone create: fs.stat 확인 → DB 조회 → 없으면 create
- standalone delete: DB 조회 → entityLink 삭제 → repository.delete

**2. `reconcileFileType(config, readFilesAsync)` — 4개 xxxReconciliation 통합**

- FS 스캔 → DB 비교 → 신규 createMany → orphan 삭제

**3. `pushChanged(channelName, workspaceId, paths)` — 5개 pushXxxChanged 통합**

```typescript
private pushChanged(channelName: string, workspaceId: string, changedRelPaths: string[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channelName, workspaceId, changedRelPaths)
  })
}
```

### applyEvents 구조 (리팩토링 후)

```typescript
private async applyEvents(events: Event[]) {
  // Step 1-2: 폴더 처리 (변경 없음 — 반드시 먼저)
  this.processFolderEvents(events)

  // Step 3-14: 파일 타입별 처리 (제네릭)
  for (const config of fileTypeConfigs) {
    this.processFileTypeEvents(events, config)
  }
}
```

### 순서 보장
- 폴더 처리가 반드시 먼저 실행됨 (for-of 루프 앞에 위치)
- 파일 타입 간에는 순서 의존성 없음 (확인 완료)
- 각 타입 내에서 rename→create→delete 순서는 `processFileTypeEvents` 내부에서 유지

### 추가: handleEvents() 내부 path 수집 리팩토링

`handleEvents()`에서도 이벤트를 타입별로 분류하는 로직이 중복됨. `fileTypeConfigs`를 활용하여 리팩토링:

```typescript
// 변경 전: 4번 반복되는 path 수집 로직
const mdPaths = events.filter(e => e.path.endsWith('.md')).map(e => e.relativePath)
const csvPaths = events.filter(e => e.path.endsWith('.csv')).map(e => e.relativePath)
// ... pdf, image 동일

// 변경 후: fileTypeConfigs 기반 루프
const changedByType = new Map<string, string[]>()
for (const config of fileTypeConfigs) {
  const paths = events
    .filter(e => config.matchExtension(path.basename(e.path)))
    .filter(e => !config.skipFilter?.(e.relativePath))
    .map(e => e.relativePath)
  if (paths.length > 0) {
    changedByType.set(config.channelName, paths)
  }
}
// push 알림
for (const [channel, paths] of changedByType) {
  this.pushChanged(channel, workspaceId, paths)
}
```

---

## Step 7: Performance Improvements

### 7-1. N+1 쿼리 해결

**변경 파일**: 4개 서비스 + workspace-watcher

```typescript
// 변경 전 (루프 내 개별 호출)
for (const entry of newFsEntries) {
  const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
}

// 변경 후 (배치 로드 + Map 캐시)
const allFolders = folderRepository.findByWorkspaceId(workspaceId)
const folderMap = new Map(allFolders.map((f) => [f.relativePath, f]))
for (const entry of newFsEntries) {
  const folder = parentRel ? folderMap.get(parentRel) ?? null : null
}
```

### 7-2. getLeafSiblings 개선

**변경 파일**: `src/main/repositories/create-file-repository.ts` + `src/main/lib/leaf-reindex.ts`

Repository factory에 `findByFolderId` 추가:

> **주의**: `isNull`은 `drizzle-orm`에서 별도 import 필요: `import { and, eq, inArray, isNull, like } from 'drizzle-orm'`

```typescript
findByFolderId(workspaceId: string, folderId: string | null): Row[] {
  if (folderId === null) {
    return db.select().from(table)
      .where(and(eq(table.workspaceId, workspaceId), isNull(table.folderId)))
      .all() as Row[]
  }
  return db.select().from(table)
    .where(and(eq(table.workspaceId, workspaceId), eq(table.folderId, folderId)))
    .all() as Row[]
}
```

leaf-reindex.ts 변경:
```typescript
export function getLeafSiblings(workspaceId: string, folderId: string | null): LeafSibling[] {
  const notes = noteRepository.findByFolderId(workspaceId, folderId)
    .map((n) => ({ id: n.id, kind: 'note' as const, order: n.order }))
  // ... 나머지 동일
}
```

---

## Implementation Order

| 순서 | 단계 | 변경 파일 수 | 신규 파일 수 | 삭제 파일 수 |
|------|------|------------|------------|------------|
| 0 | Bug Fixes | 3 | 0 | 0 |
| 1 | fs-utils 통합 | 1 | 0 | 0 |
| 2 | Service 유틸 추출 | 4 | 1 | 0 |
| 3 | Repository Factory | 4 | 1 | 0 |
| 4 | Renderer 통합 | 10+ | 3 | 4 |
| 5 | Preload Helper | 1 | 0 | 0 |
| 6 | Workspace Watcher | 1 | 0 | 0 |
| 7 | Performance | 6 | 0 | 0 |

## 검증 계획

각 Step 완료 후 다음을 실행:
1. `npm run typecheck` — 타입 오류 없음 확인
2. `npm run test` — 기존 테스트 통과
3. `npm run dev` — 수동 테스트 체크리스트 실행
