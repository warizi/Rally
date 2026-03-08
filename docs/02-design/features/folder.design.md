# Design: Folder (파일 탐색기)

> Plan 참조: `docs/01-plan/features/folder.plan.md`

---

## 1. DB Schema

### `src/main/db/schema/folder.ts`

```typescript
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    relativePath: text('relative_path').notNull(), // '/' 구분자, 워크스페이스 루트 기준
    color: text('color'),
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

export { workspaces, tabSessions, tabSnapshots, folders }
```

---

## 2. Repository

### `src/main/repositories/folder.ts`

```typescript
import { and, eq, inArray, like, not, or } from 'drizzle-orm'
import { db } from '../db'
import { folders } from '../db/schema'

export type Folder = typeof folders.$inferSelect
export type FolderInsert = typeof folders.$inferInsert

export const folderRepository = {
  findByWorkspaceId(workspaceId: string): Folder[] {
    return db.select().from(folders).where(eq(folders.workspaceId, workspaceId)).all()
  },

  findById(id: string): Folder | undefined {
    return db.select().from(folders).where(eq(folders.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): Folder | undefined {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.workspaceId, workspaceId), eq(folders.relativePath, relativePath)))
      .get()
  },

  create(data: FolderInsert): Folder {
    return db.insert(folders).values(data).returning().get()
  },

  createMany(items: FolderInsert[]): void {
    if (items.length === 0) return
    db.insert(folders).values(items).onConflictDoNothing().run()
  },

  update(
    id: string,
    data: Partial<Pick<Folder, 'relativePath' | 'color' | 'order' | 'updatedAt'>>
  ): Folder | undefined {
    return db.update(folders).set(data).where(eq(folders.id, id)).returning().get()
  },

  /**
   * 폴더 rename 시 해당 폴더 + 모든 하위 폴더의 relativePath를 일괄 업데이트
   * oldPrefix → newPrefix 로 prefix 교체 (SQLite raw query 사용)
   */
  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE folders
           SET relative_path = ? || substr(relative_path, ?),
               updated_at = ?
           WHERE workspace_id = ?
             AND (relative_path = ? OR relative_path LIKE ?)`
        )
        .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
    })()
  },

  /**
   * 폴더 삭제 시 해당 폴더 + 모든 하위 폴더 DB row 일괄 삭제
   */
  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(folders)
      .where(
        and(
          eq(folders.workspaceId, workspaceId),
          or(eq(folders.relativePath, prefix), like(folders.relativePath, `${prefix}/%`))
        )
      )
      .run()
  },

  /**
   * fs에 존재하지 않는 orphaned DB row 삭제
   * existingPaths 가 빈 배열인 경우 = 워크스페이스에 폴더가 전혀 없음
   *   → 해당 워크스페이스의 모든 folder row 삭제 (의도적 all-delete)
   *   → readDirRecursive가 accessSync 실패 시 빈 배열을 반환하므로
   *     이 케이스는 워크스페이스 경로 접근 불가일 때도 발생 가능
   *     (서비스 레이어에서 미리 accessSync 체크 후 ValidationError를 던지므로 안전)
   */
  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(folders).where(eq(folders.workspaceId, workspaceId)).run()
      return
    }
    db.delete(folders)
      .where(
        and(eq(folders.workspaceId, workspaceId), not(inArray(folders.relativePath, existingPaths)))
      )
      .run()
  },

  /**
   * siblings 전체 order 재할당 (integer reindex)
   * orderedIds: 원하는 순서로 정렬된 folder id 배열
   * bulkUpdatePathPrefix와 동일하게 db.$client.transaction + raw SQL 사용
   * (Drizzle의 db.transaction() 콜백 내 tx 객체는 better-sqlite3 driver에서
   *  타입 안정성이 불완전하므로 raw SQL로 일관성 유지)
   */
  reindexSiblings(workspaceId: string, orderedIds: string[]): void {
    const now = Date.now()
    const stmt = db.$client.prepare(
      `UPDATE folders SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(folders).where(eq(folders.id, id)).run()
  }
}
```

---

## 3. Service

### 3-1. 공유 유틸 (파일 내 private)

`src/main/services/folder.ts` 파일 상단에 위치하는 내부 헬퍼:

```typescript
import fs from 'fs'
import path from 'path'

interface FsEntry {
  name: string
  relativePath: string // '/' 구분자
}

/** fs 재귀 탐색 — 심볼릭 링크·숨김 폴더 제외 (folder-watcher.ts에서도 사용하므로 export) */
export function readDirRecursive(absBase: string, parentRel: string): FsEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FsEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    result.push({ name: entry.name, relativePath: rel })
    result.push(...readDirRecursive(absBase, rel))
  }
  return result
}

/** Windows '\' → '/' 정규화 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** 이름 충돌 해결: "name (1)", "name (2)", ... */
function resolveNameConflict(parentAbs: string, desiredName: string): string {
  let name = desiredName
  let n = 1
  while (true) {
    try {
      fs.accessSync(path.join(parentAbs, name))
      // 존재함 → suffix 증가
      name = `${desiredName} (${n})`
      n++
    } catch {
      // 접근 불가 = 존재하지 않음 → 사용 가능
      return name
    }
  }
}

/** 부모의 절대 경로 계산 (parentFolderId null = 워크스페이스 루트) */
function resolveParentAbsPath(workspacePath: string, parentRelPath: string | null): string {
  return parentRelPath ? path.join(workspacePath, parentRelPath) : workspacePath
}
```

### 3-2. `src/main/services/folder.ts`

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
// ⚠️ folder-watcher.ts를 import하지 않음 — 순환 의존성 방지
//    folderWatcher.ensureWatching 호출은 ipc/folder.ts에서 담당

export interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
}

function buildTree(
  dbFoldersByPath: Map<string, { id: string; color: string | null; order: number }>,
  fsEntries: FsEntry[]
): FolderNode[] {
  // 루트(parentPath = '') 노드부터 재귀 구성
  function buildChildren(parentRel: string): FolderNode[] {
    return fsEntries
      .filter((e) => {
        const parts = e.relativePath.split('/')
        const parentParts = parentRel ? parentRel.split('/') : []
        return (
          parts.length === parentParts.length + 1 &&
          (parentRel === '' || e.relativePath.startsWith(`${parentRel}/`))
        )
      })
      .map((e) => {
        const meta = dbFoldersByPath.get(e.relativePath)!
        return {
          id: meta.id,
          name: e.name,
          relativePath: e.relativePath,
          color: meta.color,
          order: meta.order,
          children: buildChildren(e.relativePath)
        }
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }

  return buildChildren('')
}

export const folderService = {
  /**
   * fs 트리 읽기 + lazy upsert + DB 동기화 → FolderNode 트리 반환
   * 호출 시 해당 워크스페이스의 watcher도 활성화
   */
  readTree(workspaceId: string): FolderNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const workspacePath = workspace.path
    try {
      fs.accessSync(workspacePath)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspacePath}`)
    }

    // 1. fs 탐색
    const fsEntries = readDirRecursive(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    // 2. DB 현재 rows
    const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbFolders.map((f) => f.relativePath))

    // 3. fs에 있고 DB에 없는 것 → insert (lazy upsert)
    const now = new Date()
    const toInsert = fsEntries
      .filter((e) => !dbPathSet.has(e.relativePath))
      .map((e) => ({
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        color: null,
        order: 0,
        createdAt: now,
        updatedAt: now
      }))
    folderRepository.createMany(toInsert)

    // 4. DB에 있고 fs에 없는 것 → orphan 삭제
    folderRepository.deleteOrphans(workspaceId, fsPaths)

    // 5. 최신 DB rows 재조회
    const latestRows = folderRepository.findByWorkspaceId(workspaceId)
    const metaByPath = new Map(
      latestRows.map((r) => [r.relativePath, { id: r.id, color: r.color, order: r.order }])
    )

    return buildTree(metaByPath, fsEntries)
  },

  /**
   * 새 폴더 생성 (disk + DB)
   */
  create(workspaceId: string, parentFolderId: string | null, name: string): FolderNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    // parentFolderId → relativePath 변환
    let parentRelPath: string | null = null
    if (parentFolderId) {
      const parent = folderRepository.findById(parentFolderId)
      if (!parent) throw new NotFoundError(`Parent folder not found: ${parentFolderId}`)
      parentRelPath = parent.relativePath
    }

    const parentAbs = resolveParentAbsPath(workspace.path, parentRelPath)
    const finalName = resolveNameConflict(parentAbs, name.trim() || '새 폴더')
    const newAbs = path.join(parentAbs, finalName)
    const newRel = normalizePath(parentRelPath ? `${parentRelPath}/${finalName}` : finalName)

    fs.mkdirSync(newAbs, { recursive: true })

    // siblings의 현재 max order 계산 후 +1
    const siblings = folderRepository.findByWorkspaceId(workspaceId).filter((f) => {
      const parts = f.relativePath.split('/')
      const parentParts = parentRelPath ? parentRelPath.split('/') : []
      return (
        parts.length === parentParts.length + 1 &&
        (parentRelPath === null || f.relativePath.startsWith(`${parentRelPath}/`))
      )
    })
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = folderRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: newRel,
      color: null,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })

    return {
      id: row.id,
      name: finalName,
      relativePath: row.relativePath,
      color: row.color,
      order: row.order,
      children: []
    }
  },

  /**
   * 폴더 이름 변경 (disk + DB 하위 전체)
   */
  rename(workspaceId: string, folderId: string, newName: string): FolderNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    const oldRel = folder.relativePath
    const parentRel = oldRel.includes('/') ? oldRel.split('/').slice(0, -1).join('/') : null
    const parentAbs = resolveParentAbsPath(workspace.path, parentRel)

    // 같은 이름이면 no-op (resolveNameConflict 호출 전에 먼저 체크)
    const oldName = oldRel.split('/').at(-1)!
    if (newName.trim() === oldName)
      return {
        id: folder.id,
        name: oldName,
        relativePath: oldRel,
        color: folder.color,
        order: folder.order,
        children: []
      }

    const finalName = resolveNameConflict(parentAbs, newName.trim())

    const oldAbs = path.join(workspace.path, oldRel)
    const newRel = normalizePath(parentRel ? `${parentRel}/${finalName}` : finalName)
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)
    folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)

    const updated = folderRepository.findById(folderId)!
    return {
      id: updated.id,
      name: finalName,
      relativePath: updated.relativePath,
      color: updated.color,
      order: updated.order,
      children: []
    }
  },

  /**
   * 폴더 삭제 (disk 재귀 삭제 + DB 벌크 삭제)
   */
  remove(workspaceId: string, folderId: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    const absPath = path.join(workspace.path, folder.relativePath)
    fs.rmSync(absPath, { recursive: true, force: true })
    folderRepository.bulkDeleteByPrefix(workspaceId, folder.relativePath)
  },

  /**
   * 폴더 이동 (DnD) — 다른 부모로 이동 + siblings reindex
   * index: react-arborist가 전달하는 새 위치 (0-based)
   */
  move(
    workspaceId: string,
    folderId: string,
    parentFolderId: string | null,
    index: number
  ): FolderNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    // 순환 이동 방지
    let targetParentRel: string | null = null
    if (parentFolderId) {
      const parentFolder = folderRepository.findById(parentFolderId)
      if (!parentFolder) throw new NotFoundError(`Parent folder not found: ${parentFolderId}`)
      targetParentRel = parentFolder.relativePath
      if (
        targetParentRel === folder.relativePath ||
        targetParentRel.startsWith(`${folder.relativePath}/`)
      ) {
        throw new ValidationError('순환 이동 불가: 폴더를 자기 자신의 하위로 이동할 수 없습니다.')
      }
    }

    const folderName = folder.relativePath.split('/').at(-1)!
    const currentParentRel = folder.relativePath.includes('/')
      ? folder.relativePath.split('/').slice(0, -1).join('/')
      : null
    const isSameParent = currentParentRel === targetParentRel
    const oldAbs = path.join(workspace.path, folder.relativePath)

    // 이름 충돌 해결 — 같은 부모로 이동(reorder)이면 이름 변경 없음
    // (resolveNameConflict는 자기 자신을 충돌로 감지하므로 다른 부모일 때만 호출)
    const parentAbs = resolveParentAbsPath(workspace.path, targetParentRel)
    const finalName = isSameParent ? folderName : resolveNameConflict(parentAbs, folderName)
    const finalRel = normalizePath(targetParentRel ? `${targetParentRel}/${finalName}` : finalName)
    const finalAbs = path.join(workspace.path, finalRel)

    if (oldAbs !== finalAbs) {
      fs.renameSync(oldAbs, finalAbs)
      folderRepository.bulkUpdatePathPrefix(workspaceId, folder.relativePath, finalRel)
    }

    // siblings reindex
    const siblings = folderRepository
      .findByWorkspaceId(workspaceId)
      .filter((f) => {
        const parts = f.relativePath.split('/')
        const parentParts = targetParentRel ? targetParentRel.split('/') : []
        return (
          parts.length === parentParts.length + 1 &&
          (targetParentRel === null || f.relativePath.startsWith(`${targetParentRel}/`))
        )
      })
      .sort((a, b) => a.order - b.order)

    // 현재 폴더를 목록에서 제거 후 index 위치에 삽입
    const withoutSelf = siblings.filter((s) => s.id !== folderId)
    withoutSelf.splice(index, 0, { ...folder, relativePath: finalRel })
    folderRepository.reindexSiblings(
      workspaceId,
      withoutSelf.map((s) => s.id)
    )

    const updated = folderRepository.findById(folderId)!
    return {
      id: updated.id,
      name: finalName,
      relativePath: updated.relativePath,
      color: updated.color,
      order: updated.order,
      children: []
    }
  },

  /**
   * 메타데이터 전용 업데이트 (color, order)
   */
  updateMeta(
    workspaceId: string,
    folderId: string,
    data: { color?: string | null; order?: number }
  ): FolderNode {
    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    const updated = folderRepository.update(folderId, {
      ...data,
      updatedAt: new Date()
    })!

    const name = updated.relativePath.split('/').at(-1)!
    return {
      id: updated.id,
      name,
      relativePath: updated.relativePath,
      color: updated.color,
      order: updated.order,
      children: []
    }
  }
}
```

---

### 3-3. `src/main/services/folder-watcher.ts`

```typescript
import * as parcelWatcher from '@parcel/watcher'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { folderRepository } from '../repositories/folder'
import { readDirRecursive } from './folder'
import { nanoid } from 'nanoid'

class FolderWatcherService {
  private subscription: parcelWatcher.AsyncSubscription | null = null
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null

  /**
   * watcher 없거나 다른 workspace → 전환
   * workspace.path 변경 감지: ipc/workspace.ts의 update 핸들러에서
   * folderWatcher.ensureWatching(workspaceId, newPath) 호출로 재시작
   * (activeWorkspaceId가 같아도 path가 다르면 재시작이 필요하므로
   *  workspace:update IPC 핸들러에서 activeWorkspacePath 비교 후 stop+start)
   */
  async ensureWatching(workspaceId: string, workspacePath: string): Promise<void> {
    if (this.activeWorkspaceId === workspaceId && this.activeWorkspacePath === workspacePath) return
    await this.stop()
    await this.start(workspaceId, workspacePath)
  }

  async start(workspaceId: string, workspacePath: string): Promise<void> {
    // 오프라인 중 변경사항 처리
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
    // snapshot 저장 (best-effort)
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

  /** 앱 재시작 시 오프라인 변경사항 처리 */
  private async syncOfflineChanges(workspaceId: string, workspacePath: string): Promise<void> {
    const snapshotPath = this.getSnapshotPath(workspaceId)
    let events: parcelWatcher.Event[] = []

    if (fs.existsSync(snapshotPath)) {
      try {
        events = await parcelWatcher.getEventsSince(workspacePath, snapshotPath)
      } catch {
        // journal 만료 → full reconciliation
        await this.fullReconciliation(workspaceId, workspacePath)
        return
      }
    } else {
      // 첫 실행 또는 crash → full reconciliation
      await this.fullReconciliation(workspaceId, workspacePath)
      return
    }

    // 폴더 이벤트만 처리 (배치)
    await this.applyEvents(workspaceId, workspacePath, events)

    // 새 snapshot 저장
    try {
      await parcelWatcher.writeSnapshot(workspacePath, snapshotPath)
    } catch {
      /* ignore */
    }
  }

  /** 실시간 이벤트 debounce 처리 */
  private handleEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      await this.applyEvents(workspaceId, workspacePath, events)
      this.pushChanged(workspaceId)
    }, 50)
  }

  /**
   * 이벤트 배치 → DB 동기화
   *
   * @parcel/watcher public EventType = 'create' | 'update' | 'delete'
   * 'rename' 이벤트는 공식 타입에 없음. getEventsSince 결과에서 플랫폼에 따라
   * 런타임에 oldPath 필드가 포함될 수 있으므로 방어적으로 체크.
   * 실시간 rename은 대부분 delete + create 쌍으로 전달됨 → readTree reconciliation으로 처리.
   */
  private async applyEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): Promise<void> {
    for (const event of events) {
      const absPath = event.path
      // path.relative + normalize: Windows '\\' 대응
      const rel = path.relative(workspacePath, absPath).replace(/\\/g, '/')

      // getEventsSince가 런타임에 rename + oldPath를 제공하는 경우 (플랫폼 의존적)
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
        // delete 단독 처리: DB에 해당 row가 있을 때만 삭제 (create와 쌍인 rename은 위에서 처리)
        const existing = folderRepository.findByRelativePath(workspaceId, rel)
        if (existing) {
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
        }
        continue
      }
    }
  }

  /** fs vs DB 전체 비교 동기화 */
  private async fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = readDirRecursive(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbFolders.map((f) => f.relativePath))

    // 새 폴더 insert
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

    // orphan 삭제
    folderRepository.deleteOrphans(workspaceId, fsPaths)
  }

  private getSnapshotPath(workspaceId: string): string {
    const snapshotsDir = path.join(app.getPath('userData'), 'folder-snapshots')
    fs.mkdirSync(snapshotsDir, { recursive: true })
    return path.join(snapshotsDir, `${workspaceId}.snapshot`)
  }

  private pushChanged(workspaceId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('folder:changed', workspaceId)
    })
  }
}

export const folderWatcher = new FolderWatcherService()
```

> 의존성 방향 (단방향):
>
> - `ipc/folder.ts` → `services/folder.ts`, `services/folder-watcher.ts` (각각 독립)
> - `services/folder-watcher.ts` → `services/folder.ts` (readDirRecursive)
> - `services/folder.ts` → `services/folder-watcher.ts` ❌ (import 없음, 순환 방지)

---

## 4. IPC Handler

### `src/main/ipc/folder.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { folderService } from '../services/folder'
import { folderWatcher } from '../services/folder-watcher'
import { workspaceRepository } from '../repositories/workspace'

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:readTree', (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse => {
    // watcher 활성화 (순환 의존성 방지를 위해 IPC 핸들러에서 담당)
    const workspace = workspaceRepository.findById(workspaceId)
    if (workspace) void folderWatcher.ensureWatching(workspaceId, workspace.path)
    return handle(() => folderService.readTree(workspaceId))
  })

  ipcMain.handle(
    'folder:create',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      parentFolderId: string | null,
      name: string
    ): IpcResponse => handle(() => folderService.create(workspaceId, parentFolderId, name))
  )

  ipcMain.handle(
    'folder:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, folderId: string, newName: string): IpcResponse =>
      handle(() => folderService.rename(workspaceId, folderId, newName))
  )

  ipcMain.handle(
    'folder:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, folderId: string): IpcResponse =>
      handle(() => folderService.remove(workspaceId, folderId))
  )

  ipcMain.handle(
    'folder:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string,
      parentFolderId: string | null,
      index: number
    ): IpcResponse => handle(() => folderService.move(workspaceId, folderId, parentFolderId, index))
  )

  ipcMain.handle(
    'folder:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string,
      data: { color?: string | null; order?: number }
    ): IpcResponse => handle(() => folderService.updateMeta(workspaceId, folderId, data))
  )
}
```

### `src/main/index.ts` 수정

```typescript
import { registerFolderHandlers } from './ipc/folder'
import { folderWatcher } from './services/folder-watcher'

// app.whenReady() 내부에 추가:
registerFolderHandlers()

// app.before-quit 훅 추가:
// snapshot 저장은 async이므로 preventDefault + 1초 타임아웃으로 완료를 기다림
// isQuitting 가드: app.quit() 재호출 시 무한 루프 방지
let isQuitting = false
app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  isQuitting = true
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  Promise.race([folderWatcher.stop(), timeout]).finally(() => app.quit())
})
```

### `src/main/ipc/workspace.ts` 수정 (workspace.path 변경 시 watcher 재시작)

기존 `workspace:update` IPC 핸들러에 folderWatcher 재시작 로직을 추가:

```typescript
import { folderWatcher } from '../services/folder-watcher'

// workspace:update 핸들러 내부에 추가 (workspace.update 성공 후):
ipcMain.handle('workspace:update', (_, id: string, data: Partial<...>) => {
  return handle(() => {
    const updated = workspaceService.update(id, data)
    // path가 변경된 경우 기존 watcher를 새 path로 재시작
    // fire-and-forget (void): 클라이언트는 즉시 응답 받고, watcher는 백그라운드에서 재시작
    // ensureWatching이 activeWorkspacePath와 비교하므로 path 미변경 시 no-op (early return)
    if (data.path !== undefined) {
      void folderWatcher.ensureWatching(id, updated.path)
    }
    return updated
  })
})
```

> ⚠️ 현재 `ipc/workspace.ts`에는 folderWatcher import가 없으므로 구현 시 추가 필요.
> `folderWatcher.ensureWatching()`은 `activeWorkspacePath`가 다를 때만 stop+start를 실행하므로
> path가 동일한 일반 update에는 영향 없음 (early return).

---

## 5. Preload Bridge

### `src/preload/index.ts` 수정

```typescript
// api 객체에 folder 추가:
folder: {
  readTree: (workspaceId: string) =>
    ipcRenderer.invoke('folder:readTree', workspaceId),
  create: (workspaceId: string, parentFolderId: string | null, name: string) =>
    ipcRenderer.invoke('folder:create', workspaceId, parentFolderId, name),
  rename: (workspaceId: string, folderId: string, newName: string) =>
    ipcRenderer.invoke('folder:rename', workspaceId, folderId, newName),
  remove: (workspaceId: string, folderId: string) =>
    ipcRenderer.invoke('folder:remove', workspaceId, folderId),
  move: (workspaceId: string, folderId: string, parentFolderId: string | null, index: number) =>
    ipcRenderer.invoke('folder:move', workspaceId, folderId, parentFolderId, index),
  updateMeta: (
    workspaceId: string,
    folderId: string,
    data: { color?: string | null; order?: number }
  ) => ipcRenderer.invoke('folder:updateMeta', workspaceId, folderId, data),
  onChanged: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, workspaceId: string) =>
      callback(workspaceId)
    ipcRenderer.on('folder:changed', handler)
    return () => ipcRenderer.removeListener('folder:changed', handler)
  }
}
```

### `src/preload/index.d.ts` 수정

```typescript
// FolderNode 타입 (메인 프로세스 타입 재사용 대신 인라인 정의)
interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
}

interface FolderAPI {
  readTree: (workspaceId: string) => Promise<IpcResponse<FolderNode[]>>
  create: (
    workspaceId: string,
    parentFolderId: string | null,
    name: string
  ) => Promise<IpcResponse<FolderNode>>
  rename: (
    workspaceId: string,
    folderId: string,
    newName: string
  ) => Promise<IpcResponse<FolderNode>>
  remove: (workspaceId: string, folderId: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    folderId: string,
    parentFolderId: string | null,
    index: number
  ) => Promise<IpcResponse<FolderNode>>
  updateMeta: (
    workspaceId: string,
    folderId: string,
    data: { color?: string | null; order?: number }
  ) => Promise<IpcResponse<FolderNode>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}

// interface API에 추가:
interface API {
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  folder: FolderAPI
}
```

---

## 6. Renderer — Entity

### 파일 구조

```
src/renderer/src/entities/folder/
├── index.ts
├── model/
│   ├── types.ts
│   └── use-folder-watcher.ts
└── api/
    └── queries.ts
```

### `src/renderer/src/entities/folder/model/types.ts`

```typescript
export interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
}
```

### `src/renderer/src/entities/folder/api/queries.ts`

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
import type { FolderNode } from '../model/types'

const TREE_KEY = 'folder'

export function useFolderTree(workspaceId: string): UseQueryResult<FolderNode[]> {
  return useQuery({
    queryKey: [TREE_KEY, 'tree', workspaceId],
    queryFn: async (): Promise<FolderNode[]> => {
      const res: IpcResponse<FolderNode[]> = await window.api.folder.readTree(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateFolder(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; parentFolderId: string | null; name: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, parentFolderId, name }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.create(
        workspaceId,
        parentFolderId,
        name
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useRenameFolder(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; folderId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId, newName }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.rename(
        workspaceId,
        folderId,
        newName
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useRemoveFolder(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; folderId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId }) => {
      const res: IpcResponse<void> = await window.api.folder.remove(workspaceId, folderId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useMoveFolder(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; folderId: string; parentFolderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId, parentFolderId, index }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.move(
        workspaceId,
        folderId,
        parentFolderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useUpdateFolderMeta(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; folderId: string; data: { color?: string | null; order?: number } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId, data }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.updateMeta(
        workspaceId,
        folderId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}
```

### `src/renderer/src/entities/folder/model/use-folder-watcher.ts` (push 구독 hook)

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — push 이벤트 구독 + React Query invalidation */
export function useFolderWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.folder.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['folder', 'tree', workspaceId] })
    })
    return unsub
  }, [queryClient])
}
```

### `src/renderer/src/entities/folder/index.ts`

```typescript
export type { FolderNode } from './model/types'
export {
  useFolderTree,
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder,
  useUpdateFolderMeta
} from './api/queries'
export { useFolderWatcher } from './model/use-folder-watcher'
```

---

## 7. Renderer — Feature

### 파일 구조

```
src/renderer/src/features/folder/manage-folder/
├── index.ts
└── ui/
    ├── FolderTree.tsx         ← react-arborist Tree + 콜백 → IPC 연결
    ├── FolderNodeRenderer.tsx ← 개별 노드 렌더러
    └── DeleteFolderDialog.tsx ← 삭제 확인 AlertDialog
```

### `FolderNodeRenderer.tsx`

```typescript
import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Folder, FolderOpen } from 'lucide-react'
import type { FolderNode } from '@entities/folder'

export function FolderNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<FolderNode>): JSX.Element {
  const Icon = node.isOpen ? FolderOpen : Folder

  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={() => node.toggle()}
    >
      <Icon
        className="size-4 shrink-0"
        style={{ color: node.data.color ?? undefined }}
      />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

### `DeleteFolderDialog.tsx`

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderName: string
  onConfirm: () => void
  isPending?: boolean
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  onConfirm,
  isPending
}: Props): JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>폴더 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{`"${folderName}"`}</span> 폴더와 하위 항목이 모두
            삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
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

### `FolderTree.tsx`

```typescript
import { JSX, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeApi } from 'react-arborist'
import {
  useFolderTree,
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder
} from '@entities/folder'
import type { FolderNode } from '@entities/folder'
import { FolderNodeRenderer } from './FolderNodeRenderer'
import { DeleteFolderDialog } from './DeleteFolderDialog'

interface Props {
  workspaceId: string
}

export function FolderTree({ workspaceId }: Props): JSX.Element {
  const { data: tree = [] } = useFolderTree(workspaceId)
  const { mutate: create } = useCreateFolder()
  const { mutate: rename } = useRenameFolder()
  const { mutate: remove, isPending: isRemoving } = useRemoveFolder()
  const { mutate: move } = useMoveFolder()

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  return (
    <>
      <Tree<FolderNode>
        data={tree}
        idAccessor="id"
        childrenAccessor="children"
        onCreate={({ parentId }) => {
          create({ workspaceId, parentFolderId: parentId ?? null, name: '새 폴더' })
          // CreateHandler<T> 반환 타입: (IdObj | null) | Promise<IdObj | null>
          // null 반환 = react-arborist의 인라인 노드 추가 비활성화
          // 상태는 queryClient.invalidateQueries로 외부에서 관리
          return null
        }}
        onRename={({ id, name }) => {
          rename({ workspaceId, folderId: id, newName: name })
        }}
        onMove={({ dragIds, parentId, index }) => {
          move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
        }}
        onDelete={({ ids, nodes }: { ids: string[]; nodes: NodeApi<FolderNode>[] }) => {
          if (nodes.length === 0) return
          setDeleteTarget({ id: ids[0], name: nodes[0].data.name })
        }}
        className="h-full overflow-auto"
      >
        {FolderNodeRenderer}
      </Tree>

      <DeleteFolderDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
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
    </>
  )
}
```

### `index.ts` (feature barrel)

```typescript
export { FolderTree } from './ui/FolderTree'
```

---

## 8. Page 업데이트

### `src/renderer/src/pages/folder/ui/FolderPage.tsx`

```typescript
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { FolderTree } from '@features/folder/manage-folder'

export function FolderPage(): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  return (
    <TabContainer
      header={<TabHeader title="파일 탐색기" description="파일 탐색기 관리 페이지입니다." />}
    >
      {workspaceId ? (
        <FolderTree workspaceId={workspaceId} />
      ) : (
        <div className="text-sm text-muted-foreground">워크스페이스를 선택해주세요.</div>
      )}
    </TabContainer>
  )
}
```

---

## 9. MainLayout 업데이트

### `src/renderer/src/app/layout/MainLayout.tsx` 수정

```typescript
import { useFolderWatcher } from '@entities/folder'

function MainLayout(): React.JSX.Element {
  useSessionPersistence()
  useFolderWatcher() // push 이벤트 구독 추가
  // ... 나머지 동일
}
```

---

## 10. 의존성 설치

```bash
# react-arborist: 이미 설치됨 (package.json에 존재)
# @parcel/watcher: 신규 설치 필요
npm install @parcel/watcher
```

### `package.json` — Electron rebuild 설정

`@parcel/watcher`는 native addon이므로 Electron의 Node.js 버전에 맞게 rebuild 필요.

```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w @parcel/watcher"
  }
}
```

또는 `electron-builder` 사용 시 `package.json`에 nativeRebuilder 설정 확인.

---

## 11. 마이그레이션

```bash
npm run db:generate   # src/main/db/migrations/ 에 새 파일 생성
# db:migrate는 Electron 앱 시작 시 runMigrations()에서 자동 적용
```

---

## 12. 파일 목록 요약

| 파일                                                                       | 작업                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/main/db/schema/folder.ts`                                             | 신규 생성                                      |
| `src/main/db/schema/index.ts`                                              | folders export 추가                            |
| `src/main/repositories/folder.ts`                                          | 신규 생성                                      |
| `src/main/services/folder.ts`                                              | 신규 생성                                      |
| `src/main/services/folder-watcher.ts`                                      | 신규 생성                                      |
| `src/main/ipc/folder.ts`                                                   | 신규 생성                                      |
| `src/main/index.ts`                                                        | registerFolderHandlers + before-quit hook 추가 |
| `src/preload/index.ts`                                                     | folder API 추가                                |
| `src/preload/index.d.ts`                                                   | FolderNode + FolderAPI 타입 추가               |
| `src/renderer/src/entities/folder/model/types.ts`                          | 신규 생성                                      |
| `src/renderer/src/entities/folder/api/queries.ts`                          | 신규 생성                                      |
| `src/renderer/src/entities/folder/model/use-folder-watcher.ts`             | 신규 생성                                      |
| `src/renderer/src/entities/folder/index.ts`                                | 신규 생성                                      |
| `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`         | 신규 생성                                      |
| `src/renderer/src/features/folder/manage-folder/ui/FolderNodeRenderer.tsx` | 신규 생성                                      |
| `src/renderer/src/features/folder/manage-folder/ui/DeleteFolderDialog.tsx` | 신규 생성                                      |
| `src/renderer/src/features/folder/manage-folder/index.ts`                  | 신규 생성                                      |
| `src/renderer/src/pages/folder/ui/FolderPage.tsx`                          | FolderTree 연결                                |
| `src/renderer/src/app/layout/MainLayout.tsx`                               | useFolderWatcher 추가                          |
| DB migrations (자동 생성)                                                  | db:generate 실행                               |
