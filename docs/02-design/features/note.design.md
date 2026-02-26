# Design: Note (노트 기능)

> Plan 참조: `docs/01-plan/features/note.plan.md`

---

## 0. 구현 우선순위

```
[0단계] 공유 유틸 + 패키지
  src/main/lib/fs-utils.ts 신규 (resolveNameConflict 이동, readMdFilesRecursive 추가)
  npm install @milkdown/plugin-listener

[1단계] DB + Main Process
  schema → migration → repository → service → watcher → ipc → index.ts 등록

[2단계] Preload 타입
  NoteNode, NoteAPI (onChanged 포함) 추가

[3단계] entities/note (React Query + Watcher)
  types → queries → use-note-watcher → index
  MainLayout.tsx에 useNoteWatcher() 등록

[4단계] FolderTree 리팩토링
  WorkspaceTreeNode 타입 → useWorkspaceTree →
  NoteNodeRenderer + NoteContextMenu → FolderContextMenu 수정 →
  FolderTree 수정 → FolderPage tabId 수신

[5단계] NotePage + 라우팅
  NotePage (Milkdown) → pane-routes.tsx 추가

[6단계] 통합 테스트 (수동)
  노트 생성 → 트리 표시 → 클릭 시 에디터 → 내용 자동 저장
  → 외부에서 .md 파일 수정 → 트리 자동 갱신 확인
```

---

## 1. DB Schema

### `src/main/db/schema/note.ts`

```typescript
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { folders } from './folder'

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    relativePath: text('relative_path').notNull(), // '/' 구분자, workspace 루트 기준 ("folder/note.md")
    title: text('title').notNull(), // 파일명 (.md 제외), 화면 표시용
    description: text('description').notNull().default(''),
    preview: text('preview').notNull().default(''), // 내용 앞부분 최대 200자
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [unique().on(t.workspaceId, t.relativePath)]
)
```

### `src/main/db/schema/index.ts` 수정

```typescript
import { workspaces } from './workspace'
import { tabSessions } from './tab-session'
import { tabSnapshots } from './tab-snapshot'
import { folders } from './folder'
import { notes } from './note'

export { workspaces, tabSessions, tabSnapshots, folders, notes }
```

---

## 2. Repository

### `src/main/repositories/note.ts`

```typescript
import { and, eq, inArray, not } from 'drizzle-orm'
import { db } from '../db'
import { notes } from '../db/schema'

export type Note = typeof notes.$inferSelect
export type NoteInsert = typeof notes.$inferInsert

export const noteRepository = {
  findByWorkspaceId(workspaceId: string): Note[] {
    return db.select().from(notes).where(eq(notes.workspaceId, workspaceId)).all()
  },

  findById(id: string): Note | undefined {
    return db.select().from(notes).where(eq(notes.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): Note | undefined {
    return db
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, workspaceId), eq(notes.relativePath, relativePath)))
      .get()
  },

  create(data: NoteInsert): Note {
    return db.insert(notes).values(data).returning().get()
  },

  createMany(items: NoteInsert[]): void {
    if (items.length === 0) return
    db.insert(notes).values(items).onConflictDoNothing().run()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        Note,
        'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'
      >
    >
  ): Note | undefined {
    return db.update(notes).set(data).where(eq(notes.id, id)).returning().get()
  },

  /**
   * fs에 존재하지 않는 orphaned DB row 삭제
   * existingPaths가 빈 배열이면 해당 워크스페이스의 모든 note row 삭제
   * (서비스 레이어에서 accessSync 체크 후 ValidationError를 던지므로 안전)
   */
  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(notes).where(eq(notes.workspaceId, workspaceId)).run()
      return
    }
    db.delete(notes)
      .where(
        and(eq(notes.workspaceId, workspaceId), not(inArray(notes.relativePath, existingPaths)))
      )
      .run()
  },

  delete(id: string): void {
    db.delete(notes).where(eq(notes.id, id)).run()
  }
}
```

---

## 3. 공유 유틸 + Service + Watcher

### 3-1. `src/main/lib/fs-utils.ts` (신규)

`folder.ts`의 `resolveNameConflict`를 추출하고, note용 `readMdFilesRecursive`를 추가.

```typescript
import fs from 'fs'
import path from 'path'

export interface MdFileEntry {
  name: string // 파일명 (확장자 포함, "note.md")
  relativePath: string // '/' 구분자 ("docs/note.md")
}

/**
 * .md 파일 재귀 탐색
 * 숨김 파일·디렉토리(.으로 시작), 심볼릭 링크 제외
 * .git, .obsidian 등 숨김 디렉토리 내부 탐색 안 함
 */
export function readMdFilesRecursive(absBase: string, parentRel: string): MdFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: MdFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readMdFilesRecursive(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

/**
 * 이름 충돌 해결: "name (1)", "name (2)", ... (확장자 없는 이름)
 * 노트의 경우 desiredName에 .md 포함하여 전달:
 *   resolveNameConflict(parentAbs, '새로운 노트.md') → '새로운 노트 (1).md'
 *
 * 알고리즘:
 *   - 이름에 확장자가 있으면 (예: "foo.md") → suffix를 확장자 앞에 삽입
 *     "foo.md" → "foo (1).md" → "foo (2).md"
 *   - 이름에 확장자가 없으면 (폴더용) → suffix를 끝에 붙임
 *     "foo" → "foo (1)" → "foo (2)"
 */
export function resolveNameConflict(parentAbs: string, desiredName: string): string {
  const extMatch = desiredName.match(/^(.*?)(\.[^.]+)$/)
  const base = extMatch ? extMatch[1] : desiredName
  const ext = extMatch ? extMatch[2] : ''

  let name = desiredName
  let n = 1
  while (true) {
    try {
      fs.accessSync(path.join(parentAbs, name))
      // 존재함 → suffix 증가
      name = `${base} (${n})${ext}`
      n++
    } catch {
      // 접근 불가 = 존재하지 않음 → 사용 가능
      return name
    }
  }
}
```

> **주의**: `folder.ts`의 기존 `resolveNameConflict` (private)는 fs-utils로 이동 후 삭제하고,
> `folder.ts` 상단에 `import { resolveNameConflict } from '../lib/fs-utils'`를 추가한다.
> `readDirRecursive`는 `folder.ts`에 그대로 남겨두되 (folder-watcher.ts에서 import 중), 중복 제거는 선택.

---

### 3-2. `src/main/services/note.ts`

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { noteRepository } from '../repositories/note'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readMdFilesRecursive } from '../lib/fs-utils'

export interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

/** Windows '\' → '/' 정규화 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** relativePath에서 부모 디렉토리 relative path 추출 ("folder/note.md" → "folder") */
function parentRelPath(relativePath: string): string | null {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return null // 루트 파일
  return parts.slice(0, -1).join('/')
}

function toNoteNode(note: {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}): NoteNode {
  return {
    id: note.id,
    title: note.title,
    relativePath: note.relativePath,
    description: note.description,
    preview: note.preview,
    folderId: note.folderId,
    order: note.order,
    createdAt: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt),
    updatedAt: note.updatedAt instanceof Date ? note.updatedAt : new Date(note.updatedAt)
  }
}

export const noteService = {
  /**
   * fs에서 .md 파일 탐색 + lazy upsert + orphan 삭제 → NoteNode[] 반환
   */
  readByWorkspace(workspaceId: string): NoteNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const workspacePath = workspace.path
    try {
      fs.accessSync(workspacePath)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspacePath}`)
    }

    // 1. fs 탐색 (.md 파일)
    const fsEntries = readMdFilesRecursive(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    // 2. DB 현재 rows
    const dbNotes = noteRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbNotes.map((n) => n.relativePath))

    // 3. fs에 있고 DB에 없는 것 → lazy upsert
    const now = new Date()
    const toInsert = fsEntries
      .filter((e) => !dbPathSet.has(e.relativePath))
      .map((e) => {
        // folderId: relativePath에서 부모 폴더 DB lookup으로 결정
        const parentRel = parentRelPath(e.relativePath)
        const folder = parentRel
          ? folderRepository.findByRelativePath(workspaceId, parentRel)
          : null

        return {
          id: nanoid(),
          workspaceId,
          folderId: folder?.id ?? null,
          relativePath: e.relativePath,
          title: e.name.replace(/\.md$/, ''), // 파일명에서 .md 제거
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })
    noteRepository.createMany(toInsert)

    // 4. DB에 있고 fs에 없는 것 → orphan 삭제
    noteRepository.deleteOrphans(workspaceId, fsPaths)

    // 5. 최신 DB rows 반환
    return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
  },

  /**
   * 새 노트 생성 (disk + DB)
   * name이 빈 문자열이면 '새로운 노트' 사용
   */
  create(workspaceId: string, folderId: string | null, name: string): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    // folderId → relativePath 변환
    let folderRelPath: string | null = null
    if (folderId) {
      const folder = folderRepository.findById(folderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)
      folderRelPath = folder.relativePath
    }

    const parentAbs = folderRelPath ? path.join(workspace.path, folderRelPath) : workspace.path

    const desiredFileName = (name.trim() || '새로운 노트') + '.md'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.md$/, '') // title은 .md 없는 순수 이름

    const newAbs = path.join(parentAbs, finalFileName)
    const newRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )

    // 빈 .md 파일 생성
    fs.writeFileSync(newAbs, '', 'utf-8')

    // siblings의 max order 계산 후 +1
    const siblings = noteRepository
      .findByWorkspaceId(workspaceId)
      .filter((n) => n.folderId === folderId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = noteRepository.create({
      id: nanoid(),
      workspaceId,
      folderId,
      relativePath: newRel,
      title,
      description: '',
      preview: '',
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })

    return toNoteNode(row)
  },

  /**
   * 노트 이름 변경 (disk + DB)
   */
  rename(workspaceId: string, noteId: string, newName: string): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const oldTitle = note.title
    // 같은 이름이면 no-op
    if (newName.trim() === oldTitle) return toNoteNode(note)

    const folderRelPath = parentRelPath(note.relativePath)
    const parentAbs = folderRelPath ? path.join(workspace.path, folderRelPath) : workspace.path

    const desiredFileName = newName.trim() + '.md'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.md$/, '')

    const oldAbs = path.join(workspace.path, note.relativePath)
    const newRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)

    const updated = noteRepository.update(noteId, {
      relativePath: newRel,
      title,
      updatedAt: new Date()
    })!

    return toNoteNode(updated)
  },

  /**
   * 노트 삭제 (disk + DB)
   */
  remove(workspaceId: string, noteId: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const absPath = path.join(workspace.path, note.relativePath)
    try {
      fs.unlinkSync(absPath)
    } catch {
      // 이미 외부에서 삭제된 경우 무시 (DB만 정리)
    }
    noteRepository.delete(noteId)
  },

  /**
   * .md 파일 내용 읽기
   */
  readContent(workspaceId: string, noteId: string): string {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const absPath = path.join(workspace.path, note.relativePath)
    try {
      return fs.readFileSync(absPath, 'utf-8')
    } catch {
      throw new NotFoundError(`파일을 읽을 수 없습니다: ${absPath}`)
    }
  },

  /**
   * .md 파일 내용 저장 + preview 자동 업데이트
   */
  writeContent(workspaceId: string, noteId: string, content: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const absPath = path.join(workspace.path, note.relativePath)
    fs.writeFileSync(absPath, content, 'utf-8')

    const preview = content.slice(0, 200).replace(/\s+/g, ' ').trim()
    noteRepository.update(noteId, { preview, updatedAt: new Date() })
  },

  /**
   * 메타데이터 업데이트 (description)
   */
  updateMeta(workspaceId: string, noteId: string, data: { description?: string }): NoteNode {
    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const updated = noteRepository.update(noteId, {
      ...data,
      updatedAt: new Date()
    })!

    return toNoteNode(updated)
  }
}
```

---

### 3-3. `src/main/services/workspace-watcher.ts` (신규 — `folder-watcher.ts` 대체)

> `folder-watcher.ts`를 삭제하고 `workspace-watcher.ts`로 교체.
> 기존 `FolderWatcherService` → `WorkspaceWatcherService`, `folderWatcher` → `workspaceWatcher`
> `ipc/folder.ts`의 import도 업데이트 필요 (항목 25).

```typescript
import * as parcelWatcher from '@parcel/watcher'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { folderRepository } from '../repositories/folder'
import { readDirRecursive } from './folder'
import { nanoid } from 'nanoid'

class WorkspaceWatcherService {
  private subscription: parcelWatcher.AsyncSubscription | null = null
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null

  /**
   * watcher 없거나 다른 workspace → 전환
   */
  async ensureWatching(workspaceId: string, workspacePath: string): Promise<void> {
    if (this.activeWorkspaceId === workspaceId && this.activeWorkspacePath === workspacePath) return
    await this.stop()
    await this.start(workspaceId, workspacePath)
  }

  async start(workspaceId: string, workspacePath: string): Promise<void> {
    await this.syncOfflineChanges(workspaceId, workspacePath)

    try {
      this.subscription = await parcelWatcher.subscribe(workspacePath, (err, events) => {
        if (err) return
        this.handleEvents(workspaceId, workspacePath, events)
      })
      this.activeWorkspaceId = workspaceId
      this.activeWorkspacePath = workspacePath
    } catch {
      // workspace 접근 불가 → watcher 없이 진행 (crash 방지)
    }
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.subscription) {
      await this.subscription.unsubscribe()
      this.subscription = null
    }
    if (this.activeWorkspacePath) {
      try {
        await parcelWatcher.writeSnapshot(
          this.activeWorkspacePath,
          this.getSnapshotPath(this.activeWorkspaceId!)
        )
      } catch {
        /* ignore */
      }
    }
    this.activeWorkspaceId = null
    this.activeWorkspacePath = null
  }

  private async syncOfflineChanges(workspaceId: string, workspacePath: string): Promise<void> {
    const snapshotPath = this.getSnapshotPath(workspaceId)
    let events: parcelWatcher.Event[] = []

    if (fs.existsSync(snapshotPath)) {
      try {
        events = await parcelWatcher.getEventsSince(workspacePath, snapshotPath)
      } catch {
        await this.fullReconciliation(workspaceId, workspacePath)
        return
      }
    } else {
      await this.fullReconciliation(workspaceId, workspacePath)
      return
    }

    await this.applyEvents(workspaceId, workspacePath, events)

    try {
      await parcelWatcher.writeSnapshot(workspacePath, snapshotPath)
    } catch {
      /* ignore */
    }
  }

  private handleEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      await this.applyEvents(workspaceId, workspacePath, events)
      this.pushFolderChanged(workspaceId)
      // .md 이벤트가 하나라도 있으면 note:changed push
      const hasMdEvent = events.some(
        (e) => e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
      )
      if (hasMdEvent) this.pushNoteChanged(workspaceId)
    }, 50)
  }

  /**
   * 이벤트 배치 → DB 동기화
   * 폴더 이벤트: folderRepository 업데이트
   * .md 파일 이벤트: note DB 동기화는 renderer에서 readByWorkspace 재호출 시 처리 (lazy)
   */
  private async applyEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): Promise<void> {
    for (const event of events) {
      const absPath = event.path
      const rel = path.relative(workspacePath, absPath).replace(/\\/g, '/')
      const basename = path.basename(absPath)

      // .md 파일 이벤트 → pushNoteChanged만 (handleEvents에서 처리)
      if (absPath.endsWith('.md')) continue

      // getEventsSince rename + oldPath (플랫폼 의존적)
      if (
        'oldPath' in event &&
        typeof (event as unknown as { oldPath: string }).oldPath === 'string'
      ) {
        const oldRel = path
          .relative(workspacePath, (event as unknown as { oldPath: string }).oldPath)
          .replace(/\\/g, '/')
        folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        continue
      }

      if (event.type === 'create') {
        try {
          const stat = await fs.promises.stat(absPath)
          if (!stat.isDirectory()) continue
        } catch {
          continue
        }
        if (basename.startsWith('.')) continue
        const existing = folderRepository.findByRelativePath(workspaceId, rel)
        if (!existing) {
          const now = new Date()
          folderRepository.create({
            id: nanoid(),
            workspaceId,
            relativePath: rel,
            color: null,
            order: 0,
            createdAt: now,
            updatedAt: now
          })
        }
        continue
      }

      if (event.type === 'delete') {
        const existing = folderRepository.findByRelativePath(workspaceId, rel)
        if (existing) {
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
        }
        continue
      }
    }
  }

  private async fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = readDirRecursive(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbFolders.map((f) => f.relativePath))

    const now = new Date()
    const toInsert = fsEntries
      .filter((e) => !dbPathSet.has(e.relativePath))
      .map((e) => ({
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        color: null as null,
        order: 0,
        createdAt: now,
        updatedAt: now
      }))
    folderRepository.createMany(toInsert)
    folderRepository.deleteOrphans(workspaceId, fsPaths)
  }

  private getSnapshotPath(workspaceId: string): string {
    const snapshotsDir = path.join(app.getPath('userData'), 'workspace-snapshots')
    fs.mkdirSync(snapshotsDir, { recursive: true })
    return path.join(snapshotsDir, `${workspaceId}.snapshot`)
  }

  private pushFolderChanged(workspaceId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('folder:changed', workspaceId)
    })
  }

  /** .md 파일 변경 시 renderer에 push */
  private pushNoteChanged(workspaceId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('note:changed', workspaceId)
    })
  }
}

export const workspaceWatcher = new WorkspaceWatcherService()
```

---

## 4. IPC Handler

### `src/main/ipc/note.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { noteService } from '../services/note'

export function registerNoteHandlers(): void {
  ipcMain.handle(
    'note:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => noteService.readByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'note:create',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      name: string
    ): IpcResponse => handle(() => noteService.create(workspaceId, folderId, name))
  )

  ipcMain.handle(
    'note:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string, newName: string): IpcResponse =>
      handle(() => noteService.rename(workspaceId, noteId, newName))
  )

  ipcMain.handle(
    'note:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string): IpcResponse =>
      handle(() => noteService.remove(workspaceId, noteId))
  )

  ipcMain.handle(
    'note:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string): IpcResponse =>
      handle(() => noteService.readContent(workspaceId, noteId))
  )

  ipcMain.handle(
    'note:writeContent',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string, content: string): IpcResponse =>
      handle(() => noteService.writeContent(workspaceId, noteId, content))
  )

  ipcMain.handle(
    'note:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      noteId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => noteService.updateMeta(workspaceId, noteId, data))
  )
}
```

### `src/main/index.ts` 수정

```typescript
// 기존 import 변경:
// import { folderWatcher } from './services/folder-watcher'   ← 삭제
import { workspaceWatcher } from './services/workspace-watcher' // ← 추가

// 신규 import 추가:
import { registerNoteHandlers } from './ipc/note'

// app.whenReady() 내부에 추가:
registerNoteHandlers()

// before-quit hook 수정 (folderWatcher → workspaceWatcher):
Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
```

### `src/main/ipc/folder.ts` 수정

```typescript
// 변경 전:
import { folderWatcher } from '../services/folder-watcher'
// 변경 후:
import { workspaceWatcher } from '../services/workspace-watcher'

// 내부 사용처 모두 folderWatcher → workspaceWatcher 로 교체:
//   void folderWatcher.ensureWatching(...) → void workspaceWatcher.ensureWatching(...)
```

> `ipc/workspace.ts`에 folderWatcher 참조가 있다면 마찬가지로 `workspaceWatcher`로 변경.

---

## 5. Preload Bridge

### `src/preload/index.ts` 수정

```typescript
// api 객체에 note 추가:
note: {
  readByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('note:readByWorkspace', workspaceId),
  create: (workspaceId: string, folderId: string | null, name: string) =>
    ipcRenderer.invoke('note:create', workspaceId, folderId, name),
  rename: (workspaceId: string, noteId: string, newName: string) =>
    ipcRenderer.invoke('note:rename', workspaceId, noteId, newName),
  remove: (workspaceId: string, noteId: string) =>
    ipcRenderer.invoke('note:remove', workspaceId, noteId),
  readContent: (workspaceId: string, noteId: string) =>
    ipcRenderer.invoke('note:readContent', workspaceId, noteId),
  writeContent: (workspaceId: string, noteId: string, content: string) =>
    ipcRenderer.invoke('note:writeContent', workspaceId, noteId, content),
  updateMeta: (workspaceId: string, noteId: string, data: { description?: string }) =>
    ipcRenderer.invoke('note:updateMeta', workspaceId, noteId, data),
  onChanged: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, workspaceId: string): void =>
      callback(workspaceId)
    ipcRenderer.on('note:changed', handler)
    return () => ipcRenderer.removeListener('note:changed', handler)
  }
},
```

### `src/preload/index.d.ts` 수정

```typescript
// NoteNode 타입 추가 (메인 프로세스 타입 재사용 대신 인라인 정의)
interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface NoteAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<NoteNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<NoteNode>>
  rename: (workspaceId: string, noteId: string, newName: string) => Promise<IpcResponse<NoteNode>>
  remove: (workspaceId: string, noteId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, noteId: string) => Promise<IpcResponse<string>>
  writeContent: (workspaceId: string, noteId: string, content: string) => Promise<IpcResponse<void>>
  updateMeta: (
    workspaceId: string,
    noteId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<NoteNode>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}

// interface API에 note 추가:
interface API {
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  folder: FolderAPI
  note: NoteAPI
}
```

---

## 6. Renderer — Entity

### 파일 구조

```
src/renderer/src/entities/note/
├── index.ts
├── model/
│   ├── types.ts
│   └── use-note-watcher.ts
└── api/
    └── queries.ts
```

### `src/renderer/src/entities/note/model/types.ts`

```typescript
export interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}
```

### `src/renderer/src/entities/note/api/queries.ts`

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
import type { NoteNode } from '../model/types'

const NOTE_KEY = 'note'

export function useNotesByWorkspace(workspaceId: string): UseQueryResult<NoteNode[]> {
  return useQuery({
    queryKey: [NOTE_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<NoteNode[]> => {
      const res: IpcResponse<NoteNode[]> = await window.api.note.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateNote(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; name: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId, name }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.create(workspaceId, folderId, name)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenameNote(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; noteId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, noteId, newName }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.rename(workspaceId, noteId, newName)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveNote(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; noteId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, noteId }) => {
      const res: IpcResponse<void> = await window.api.note.remove(workspaceId, noteId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadNoteContent(workspaceId: string, noteId: string): UseQueryResult<string> {
  return useQuery({
    queryKey: [NOTE_KEY, 'content', noteId],
    queryFn: async (): Promise<string> => {
      const res: IpcResponse<string> = await window.api.note.readContent(workspaceId, noteId)
      if (!res.success) throwIpcError(res)
      return res.data ?? ''
    },
    enabled: !!workspaceId && !!noteId,
    staleTime: Infinity // 편집 중 React Query 자동 refetch로 내용 덮어쓰기 방지
  })
}

export function useWriteNoteContent(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; noteId: string; content: string }
> {
  return useMutation({
    mutationFn: async ({ workspaceId, noteId, content }) => {
      const res: IpcResponse<void> = await window.api.note.writeContent(
        workspaceId,
        noteId,
        content
      )
      if (!res.success) throwIpcError(res)
    }
    // invalidate 불필요: staleTime: Infinity이므로 UI는 에디터 상태 우선
  })
}

export function useUpdateNoteMeta(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; noteId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, noteId, data }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.updateMeta(workspaceId, noteId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}
```

### `src/renderer/src/entities/note/model/use-note-watcher.ts`

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — note:changed push 이벤트 구독 + React Query invalidation */
export function useNoteWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.note.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['note', 'workspace', workspaceId] })
    })
    return unsub
  }, [queryClient])
}
```

### `src/renderer/src/entities/note/index.ts`

```typescript
export type { NoteNode } from './model/types'
export {
  useNotesByWorkspace,
  useCreateNote,
  useRenameNote,
  useRemoveNote,
  useReadNoteContent,
  useWriteNoteContent,
  useUpdateNoteMeta
} from './api/queries'
export { useNoteWatcher } from './model/use-note-watcher'
```

---

## 7. Renderer — Feature (FolderTree 리팩토링)

### 파일 구조

```
src/renderer/src/features/folder/manage-folder/
├── index.ts
├── model/
│   ├── types.ts              ← WorkspaceTreeNode union 타입 (신규)
│   └── use-workspace-tree.ts ← folder + note 병합 훅 (신규)
└── ui/
    ├── FolderTree.tsx         ← 리팩토링 (WorkspaceTreeNode + tabId)
    ├── FolderNodeRenderer.tsx ← 기존 유지 (FolderTreeNode 타입으로 변경)
    ├── FolderContextMenu.tsx  ← onCreateNote prop 추가
    ├── NoteNodeRenderer.tsx   ← 신규
    ├── NoteContextMenu.tsx    ← 신규
    ├── FolderNameDialog.tsx   ← 기존 유지 (노트 rename에도 재사용)
    ├── FolderColorDialog.tsx  ← 기존 유지
    └── DeleteFolderDialog.tsx ← 기존 유지 (노트 delete에도 재사용)
```

### `src/renderer/src/features/folder/manage-folder/model/types.ts`

```typescript
export interface FolderTreeNode {
  kind: 'folder'
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: WorkspaceTreeNode[] // 하위 폴더 + 노트 혼합
}

export interface NoteTreeNode {
  kind: 'note'
  id: string
  name: string // NoteNode.title에서 매핑
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
}

export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode
```

### `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts`

```typescript
import { useFolderTree } from '@entities/folder'
import type { FolderNode } from '@entities/folder'
import { useNotesByWorkspace } from '@entities/note'
import type { NoteNode } from '@entities/note'
import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode } from './types'

/**
 * FolderNode[] + NoteNode[] → WorkspaceTreeNode[] 병합
 *
 * 변환 규칙:
 * - useFolderTree는 이미 nested tree (children 포함)를 반환함 → children을 그대로 활용
 * - NoteNode.title → NoteTreeNode.name (필드명 매핑 주의)
 * - 각 폴더의 children 끝에 해당 folder.id의 notes를 추가 (order 기준 정렬)
 * - folderId=null인 루트 노트는 루트 레벨 맨 끝에 추가
 * - 노트는 항상 폴더들 뒤에 표시
 */
function buildWorkspaceTree(
  folders: FolderNode[], // useFolderTree가 반환하는 nested tree (root 폴더만 top-level)
  notes: NoteNode[]
): WorkspaceTreeNode[] {
  function convertNote(note: NoteNode): NoteTreeNode {
    return {
      kind: 'note',
      id: note.id,
      name: note.title, // title → name 매핑
      relativePath: note.relativePath,
      description: note.description,
      preview: note.preview,
      folderId: note.folderId,
      order: note.order
    }
  }

  // FolderNode → FolderTreeNode 변환 (재귀)
  // FolderNode.children은 folderService.readTree가 이미 구성 → 그대로 재귀 변환
  function convertFolder(folder: FolderNode): FolderTreeNode {
    const childFolders = folder.children
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(convertFolder)

    const childNotes = notes
      .filter((n) => n.folderId === folder.id) // folderId로 직접 매핑
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .map(convertNote)

    return {
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      relativePath: folder.relativePath,
      color: folder.color,
      order: folder.order,
      children: [...childFolders, ...childNotes]
    }
  }

  // folders는 root 폴더만 포함 (nested tree의 top-level)
  const rootFolders = folders
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(convertFolder)

  // 루트 노트 (folderId=null)
  const rootNotes = notes
    .filter((n) => n.folderId === null)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map(convertNote)

  return [...rootFolders, ...rootNotes]
}

export function useWorkspaceTree(workspaceId: string): {
  tree: WorkspaceTreeNode[]
  isLoading: boolean
} {
  const { data: folders = [], isLoading: isFoldersLoading } = useFolderTree(workspaceId)
  const { data: notes = [], isLoading: isNotesLoading } = useNotesByWorkspace(workspaceId)

  const tree = buildWorkspaceTree(folders, notes)

  return {
    tree,
    isLoading: isFoldersLoading || isNotesLoading
  }
}
```

### `src/renderer/src/features/folder/manage-folder/ui/FolderNodeRenderer.tsx` 타입 변경

기존 `FolderNode` (entities layer) → `FolderTreeNode` (feature model layer) 타입으로 교체.
FolderTree의 NodeRenderer에서 `props as unknown as NodeRendererProps<FolderTreeNode>` 캐스팅과 일치시켜야 TypeScript 오류가 없음.

```tsx
import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Folder, FolderOpen } from 'lucide-react'
import type { FolderTreeNode } from '../model/types' // ← entities/folder 대신 feature model 사용

export function FolderNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<FolderTreeNode>): JSX.Element {
  // ← FolderNode → FolderTreeNode
  const Icon = node.isOpen ? FolderOpen : Folder

  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={() => node.toggle()}
    >
      <Icon className="ml-1 size-4 shrink-0" style={{ color: node.data.color ?? undefined }} />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

---

### `src/renderer/src/features/folder/manage-folder/ui/NoteNodeRenderer.tsx` (신규)

```tsx
import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Notebook } from 'lucide-react'
import type { NoteTreeNode } from '../model/types'

interface NoteNodeRendererProps extends NodeRendererProps<NoteTreeNode> {
  onOpen: () => void
}

export function NoteNodeRenderer({
  node,
  style,
  dragHandle,
  onOpen
}: NoteNodeRendererProps): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <Notebook className="ml-1 size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

### `src/renderer/src/features/folder/manage-folder/ui/NoteContextMenu.tsx` (신규)

```tsx
import { JSX } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'

interface Props {
  children: React.ReactNode
  onRename: () => void
  onDelete: () => void
}

export function NoteContextMenu({ children, onRename, onDelete }: Props): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={onRename}>
          <Pencil className="size-4 mr-2" />
          이름 변경
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

### `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx` 수정

```tsx
// Props에 onCreateNote 추가
interface Props {
  children: React.ReactNode
  onCreateChild: () => void
  onCreateNote: () => void // ← 추가
  onRename: () => void
  onEditColor: () => void
  onDelete: () => void
}

// ContextMenuContent 내에 추가 (하위 폴더 생성 항목 바로 아래):
;<ContextMenuItem onClick={onCreateNote}>
  <Notebook className="size-4 mr-2" />
  노트 추가하기
</ContextMenuItem>
```

> 전체 파일 변경:
>
> - import에 `Notebook` 추가 (lucide-react)
> - Props에 `onCreateNote: () => void` 추가
> - 컴포넌트 구조 분해에 `onCreateNote` 추가
> - ContextMenuContent에 노트 추가하기 항목 삽입 (하위 폴더 생성 바로 아래, Separator 없이)

### `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx` (리팩토링)

```tsx
import { JSX, useCallback, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeApi, NodeRendererProps } from 'react-arborist'
import { FolderPlus } from 'lucide-react'
import {
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder,
  useUpdateFolderMeta
} from '@entities/folder'
import { useCreateNote, useRenameNote, useRemoveNote } from '@entities/note'
import { Button } from '@shared/ui/button'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode } from '../model/types'
import { FolderColorDialog } from './FolderColorDialog'
import { FolderContextMenu } from './FolderContextMenu'
import { FolderNameDialog } from './FolderNameDialog'
import { FolderNodeRenderer } from './FolderNodeRenderer'
import { NoteContextMenu } from './NoteContextMenu'
import { NoteNodeRenderer } from './NoteNodeRenderer'
import { DeleteFolderDialog } from './DeleteFolderDialog'

interface Props {
  workspaceId: string
  tabId?: string // sourcePaneId 계산용 (FolderPage에서 전달)
}

export function FolderTree({ workspaceId, tabId }: Props): JSX.Element {
  const { tree } = useWorkspaceTree(workspaceId)

  // Folder mutations
  const { mutate: createFolder, isPending: isCreatingFolder } = useCreateFolder()
  const { mutate: rename, isPending: isRenaming } = useRenameFolder()
  const { mutate: remove, isPending: isRemoving } = useRemoveFolder()
  const { mutate: move } = useMoveFolder()
  const { mutate: updateMeta, isPending: isUpdatingMeta } = useUpdateFolderMeta()

  // Note mutations
  // isCreatingNote: 노트 생성은 dialog 없이 즉시 실행이므로 isPending UI 불필요
  const { mutate: createNote } = useCreateNote()
  const { mutate: renameNote, isPending: isRenamingNote } = useRenameNote()
  const { mutate: removeNote, isPending: isRemovingNote } = useRemoveNote()

  // Tab store
  const openRightTab = useTabStore((s) => s.openRightTab)
  const findPaneByTabId = useTabStore((s) => s.findPaneByTabId)
  const sourcePaneId = tabId ? (findPaneByTabId(tabId)?.id ?? '') : ''

  // Folder dialog states
  const [createTarget, setCreateTarget] = useState<{ parentFolderId: string | null } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [colorTarget, setColorTarget] = useState<{ id: string; color: string | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // Note dialog states
  const [noteRenameTarget, setNoteRenameTarget] = useState<{ id: string; name: string } | null>(
    null
  )
  const [noteDeleteTarget, setNoteDeleteTarget] = useState<{ id: string; name: string } | null>(
    null
  )

  /** 노트 생성 → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleCreateNote = useCallback(
    (folderId: string | null) => {
      createNote(
        { workspaceId, folderId, name: '새로운 노트' },
        {
          onSuccess: (note) => {
            if (!note) return
            openRightTab(
              {
                type: 'note',
                title: note.title,
                pathname: `/folder/note/${note.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, createNote, openRightTab]
  )

  const NodeRenderer = useCallback(
    (props: NodeRendererProps<WorkspaceTreeNode>) => {
      if (props.node.data.kind === 'note') {
        return (
          <NoteContextMenu
            onRename={() =>
              setNoteRenameTarget({ id: props.node.data.id, name: props.node.data.name })
            }
            onDelete={() =>
              setNoteDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div>
              <NoteNodeRenderer
                {...(props as unknown as NodeRendererProps<NoteTreeNode>)}
                onOpen={() =>
                  openRightTab(
                    {
                      type: 'note',
                      title: props.node.data.name,
                      pathname: `/folder/note/${props.node.data.id}`
                    },
                    sourcePaneId
                  )
                }
              />
            </div>
          </NoteContextMenu>
        )
      }

      // kind === 'folder'
      return (
        <FolderContextMenu
          onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
          onCreateNote={() => handleCreateNote(props.node.id)}
          onRename={() => setRenameTarget({ id: props.node.id, name: props.node.data.name })}
          onEditColor={() =>
            setColorTarget({
              id: props.node.id,
              color: (props.node.data as FolderTreeNode).color
            })
          }
          onDelete={() => setDeleteTarget({ id: props.node.id, name: props.node.data.name })}
        >
          <div>
            <FolderNodeRenderer {...(props as unknown as NodeRendererProps<FolderTreeNode>)} />
          </div>
        </FolderContextMenu>
      )
    },
    // workspaceId는 NodeRenderer 내부에서 직접 참조하지 않음
    // (handleCreateNote가 이미 workspaceId를 capture하고 있어 deps에서 제외)
    [sourcePaneId, handleCreateNote, openRightTab]
  )

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between py-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          파일
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setCreateTarget({ parentFolderId: null })}
          title="루트 폴더 추가"
        >
          <FolderPlus className="size-3.5" />
        </Button>
      </div>

      {/* 트리 또는 빈 상태 */}
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground px-4">
          <FolderPlus className="size-8 opacity-30" />
          <p className="text-xs text-center">폴더가 없습니다.</p>
          <p className="text-xs text-center opacity-70">위의 + 버튼으로 폴더를 추가하세요.</p>
        </div>
      ) : (
        <Tree<WorkspaceTreeNode>
          data={tree}
          idAccessor="id"
          childrenAccessor={(n) => (n.kind === 'folder' ? n.children : null)}
          disableDrop={({ dragNodes }) => dragNodes.some((n) => n.data.kind === 'note')}
          disableEdit={(n) => n.data.kind === 'note'} // 노트는 인라인 rename 비활성화 (F2 → context menu 사용)
          onCreate={({ parentId }) => {
            setCreateTarget({ parentFolderId: parentId ?? null })
            return null
          }}
          onRename={({ id, name }) => {
            // react-arborist 인라인 rename은 폴더 전용 (disableEdit으로 노트 진입 차단)
            rename({ workspaceId, folderId: id, newName: name })
          }}
          onMove={({ dragIds, parentId, index }) => {
            move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
          }}
          onDelete={({ ids, nodes }: { ids: string[]; nodes: NodeApi<WorkspaceTreeNode>[] }) => {
            if (nodes.length === 0) return
            const firstNode = nodes[0]
            if (firstNode.data.kind === 'note') {
              setNoteDeleteTarget({ id: ids[0], name: firstNode.data.name })
            } else {
              setDeleteTarget({ id: ids[0], name: firstNode.data.name })
            }
          }}
          width="100%"
          className="flex-1 overflow-auto px-2"
        >
          {NodeRenderer}
        </Tree>
      )}

      {/* 폴더 생성 다이얼로그 */}
      <FolderNameDialog
        open={createTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCreateTarget(null)
        }}
        title="폴더 생성"
        defaultValue=""
        submitLabel="생성"
        isPending={isCreatingFolder}
        onSubmit={(name) => {
          if (createTarget) {
            createFolder(
              { workspaceId, parentFolderId: createTarget.parentFolderId, name },
              { onSuccess: () => setCreateTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 이름 변경 다이얼로그 */}
      <FolderNameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        title="이름 변경"
        defaultValue={renameTarget?.name ?? ''}
        submitLabel="변경"
        isPending={isRenaming}
        onSubmit={(name) => {
          if (renameTarget) {
            rename(
              { workspaceId, folderId: renameTarget.id, newName: name },
              { onSuccess: () => setRenameTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 색상 다이얼로그 */}
      <FolderColorDialog
        open={colorTarget !== null}
        onOpenChange={(open) => {
          if (!open) setColorTarget(null)
        }}
        currentColor={colorTarget?.color ?? null}
        isPending={isUpdatingMeta}
        onSubmit={(color) => {
          if (colorTarget) {
            updateMeta(
              { workspaceId, folderId: colorTarget.id, data: { color } },
              { onSuccess: () => setColorTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 삭제 다이얼로그 */}
      <DeleteFolderDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        folderName={deleteTarget?.name ?? ''}
        isPending={isRemoving}
        onConfirm={() => {
          if (deleteTarget) {
            remove(
              { workspaceId, folderId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) }
            )
          }
        }}
      />

      {/* 노트 이름 변경 다이얼로그 (FolderNameDialog 재사용) */}
      <FolderNameDialog
        open={noteRenameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNoteRenameTarget(null)
        }}
        title="노트 이름 변경"
        defaultValue={noteRenameTarget?.name ?? ''}
        submitLabel="변경"
        isPending={isRenamingNote}
        onSubmit={(name) => {
          if (noteRenameTarget) {
            renameNote(
              { workspaceId, noteId: noteRenameTarget.id, newName: name },
              { onSuccess: () => setNoteRenameTarget(null) }
            )
          }
        }}
      />

      {/* 노트 삭제 다이얼로그 (DeleteFolderDialog 재사용) */}
      <DeleteFolderDialog
        open={noteDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNoteDeleteTarget(null)
        }}
        folderName={noteDeleteTarget?.name ?? ''}
        isPending={isRemovingNote}
        onConfirm={() => {
          if (noteDeleteTarget) {
            removeNote(
              { workspaceId, noteId: noteDeleteTarget.id },
              { onSuccess: () => setNoteDeleteTarget(null) }
            )
          }
        }}
      />
    </div>
  )
}
```

### `src/renderer/src/features/folder/manage-folder/index.ts` 업데이트

```typescript
export { FolderTree } from './ui/FolderTree'
export type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode } from './model/types'
```

---

## 8. Page 업데이트

### `src/renderer/src/pages/folder/ui/FolderPage.tsx` 수정

> **FSD 주의**: `pages/`에서 `@app/layout/model/pane-routes`를 import하면 pages → app 방향 위반.
> `PageProps` 타입을 `@app`에서 가져오는 대신 인라인으로 정의한다.

```tsx
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { FolderTree } from '@features/folder/manage-folder'

// PageProps 대신 tabId만 인라인 타입으로 선언 (FSD 위반 방지)
export function FolderPage({ tabId }: { tabId?: string }): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  return (
    <TabContainer
      header={<TabHeader title="파일 탐색기" description="파일 탐색기 관리 페이지입니다." />}
    >
      {workspaceId ? (
        <FolderTree workspaceId={workspaceId} tabId={tabId} />
      ) : (
        <div className="text-sm text-muted-foreground">워크스페이스를 선택해주세요.</div>
      )}
    </TabContainer>
  )
}
```

### `src/renderer/src/pages/note/ui/NotePage.tsx` (신규)

> **FSD 주의**: `pages/`에서 `@app/layout/model/pane-routes`를 import하면 pages → app 방향 위반.
> `params`를 `Record<string, string>` 인라인으로 받아 FSD 위반 방지.

```tsx
import { JSX, useCallback, useEffect, useRef } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadNoteContent, useWriteNoteContent } from '@entities/note'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'

interface NoteEditorProps {
  initialContent: string
  onSave: (markdown: string) => void
}

function NoteEditor({ initialContent, onSave }: NoteEditorProps): JSX.Element {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialContent)
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          // plugin-listener 내장 200ms debounce 후 호출됨
          // 앱 레벨 debounce는 onSave 외부(NotePage)에서 처리
          onSave(markdown)
        })
      })
      .use(commonmark)
      .use(listener)
  )
  return <Milkdown />
}

// @app import 대신 인라인 타입 (FSD 위반 방지: pages → app 금지)
export function NotePage({ params }: { params?: Record<string, string> }): JSX.Element {
  const noteId = params?.noteId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''

  const { data: content, isLoading, isError } = useReadNoteContent(workspaceId, noteId)
  const { mutate: writeContent } = useWriteNoteContent()

  // 앱 레벨 debounce (800ms)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const handleSave = useCallback(
    (markdown: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        writeContent({ workspaceId, noteId, content: markdown })
      }, 800)
    },
    [workspaceId, noteId, writeContent]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  if (!noteId || !workspaceId) {
    return (
      <TabContainer>
        <div className="text-sm text-muted-foreground p-4">노트 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  if (isLoading) {
    return (
      <TabContainer>
        <div className="text-sm text-muted-foreground p-4">불러오는 중...</div>
      </TabContainer>
    )
  }

  if (isError) {
    return (
      <TabContainer>
        <div className="text-sm text-destructive p-4">
          노트를 불러올 수 없습니다. 파일이 삭제되었거나 이동되었을 수 있습니다.
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer>
      <div className="h-full overflow-auto p-4">
        <MilkdownProvider>
          <NoteEditor initialContent={content ?? ''} onSave={handleSave} />
        </MilkdownProvider>
      </div>
    </TabContainer>
  )
}
```

### `src/renderer/src/pages/note/index.ts` (신규)

```typescript
export { NotePage } from './ui/NotePage'
```

---

## 9. MainLayout + 라우팅 업데이트

### `src/renderer/src/app/layout/MainLayout.tsx` 수정

```typescript
import { useFolderWatcher } from '@entities/folder'
import { useNoteWatcher } from '@entities/note'

function MainLayout(): React.JSX.Element {
  useSessionPersistence()
  useFolderWatcher() // 기존
  useNoteWatcher() // 추가
  // ... 나머지 동일
}
```

### `src/renderer/src/app/layout/model/pane-routes.tsx` 수정

```typescript
const NotePage = lazy(() => import('@pages/note'))

// PANE_ROUTES에 추가:
{
  pattern: ROUTES.NOTE_DETAIL,
  component: NotePage
}
```

---

## 10. 패키지 설치

```bash
# @milkdown/plugin-listener: node_modules에 이미 존재 (transitive dep of @milkdown/kit)
# package.json에 명시적 선언 추가
npm install @milkdown/plugin-listener
```

---

## 11. 마이그레이션

```bash
npm run db:generate   # src/main/db/migrations/ 에 새 파일 생성
# db:migrate는 Electron 앱 시작 시 runMigrations()에서 자동 적용
```

---

## 12. 파일 목록 요약

| 파일                                                                         | 작업                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/main/lib/fs-utils.ts`                                                   | 신규 생성 (`resolveNameConflict`, `readMdFilesRecursive`) |
| `src/main/db/schema/note.ts`                                                 | 신규 생성                                                 |
| `src/main/db/schema/index.ts`                                                | `notes` export 추가                                       |
| `src/main/repositories/note.ts`                                              | 신규 생성                                                 |
| `src/main/services/note.ts`                                                  | 신규 생성                                                 |
| `src/main/services/workspace-watcher.ts`                                     | 신규 생성 (`folder-watcher.ts` 대체)                      |
| `src/main/services/folder-watcher.ts`                                        | 삭제                                                      |
| `src/main/services/folder.ts`                                                | `resolveNameConflict` → `fs-utils.ts` import로 교체       |
| `src/main/ipc/note.ts`                                                       | 신규 생성                                                 |
| `src/main/ipc/folder.ts`                                                     | `folderWatcher` → `workspaceWatcher` import 변경          |
| `src/main/index.ts`                                                          | `workspaceWatcher`, `registerNoteHandlers` 추가           |
| `src/preload/index.ts`                                                       | `note` API 추가                                           |
| `src/preload/index.d.ts`                                                     | `NoteNode`, `NoteAPI`, `API.note` 추가                    |
| `src/renderer/src/entities/note/model/types.ts`                              | 신규 생성                                                 |
| `src/renderer/src/entities/note/api/queries.ts`                              | 신규 생성                                                 |
| `src/renderer/src/entities/note/model/use-note-watcher.ts`                   | 신규 생성                                                 |
| `src/renderer/src/entities/note/index.ts`                                    | 신규 생성                                                 |
| `src/renderer/src/features/folder/manage-folder/model/types.ts`              | 신규 생성 (WorkspaceTreeNode)                             |
| `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` | 신규 생성                                                 |
| `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`           | 리팩토링                                                  |
| `src/renderer/src/features/folder/manage-folder/ui/FolderNodeRenderer.tsx`   | `FolderNode` → `FolderTreeNode` 타입 변경                 |
| `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx`    | `onCreateNote` 추가                                       |
| `src/renderer/src/features/folder/manage-folder/ui/NoteNodeRenderer.tsx`     | 신규 생성                                                 |
| `src/renderer/src/features/folder/manage-folder/ui/NoteContextMenu.tsx`      | 신규 생성                                                 |
| `src/renderer/src/features/folder/manage-folder/index.ts`                    | 업데이트                                                  |
| `src/renderer/src/pages/folder/ui/FolderPage.tsx`                            | `tabId` prop 추가                                         |
| `src/renderer/src/pages/note/ui/NotePage.tsx`                                | 신규 생성                                                 |
| `src/renderer/src/pages/note/index.ts`                                       | 신규 생성                                                 |
| `src/renderer/src/app/layout/MainLayout.tsx`                                 | `useNoteWatcher()` 추가                                   |
| `src/renderer/src/app/layout/model/pane-routes.tsx`                          | `NotePage` 라우트 추가                                    |
| DB migrations (자동 생성)                                                    | `npm run db:generate` 실행                                |
