# Design: CSV (CSV 파일 뷰어/에디터)

> Plan 참조: `docs/01-plan/features/csv.plan.md`

---

## 0. 구현 우선순위

```
[0단계] 패키지 설치 + 공유 유틸
  npm install papaparse @types/papaparse chardet iconv-lite
  npm install @tanstack/react-table @tanstack/react-virtual
  src/main/lib/fs-utils.ts 확장 (readCsvFilesRecursiveAsync)
  src/main/lib/leaf-reindex.ts 신규 (혼합 reindex)

[1단계] DB + Main Process
  schema → migration → repository → service → ipc → index.ts 등록
  기존 noteService.move/create 수정 (순서 공유)

[2단계] Watcher 확장
  workspace-watcher.ts — .csv 이벤트 + csvReconciliation + pushCsvChanged
  Step 1 폴더 감지 필터에 .csv 제외

[3단계] Preload 타입
  CsvFileNode, CsvAPI (onChanged 포함) 추가

[4단계] entities/csv-file (React Query + Watcher)
  types → queries → own-write-tracker → use-csv-watcher → index
  MainLayout.tsx에 useCsvWatcher() 등록

[5단계] FolderTree 확장
  CsvTreeNode 타입 → useWorkspaceTree 확장 →
  CsvNodeRenderer + CsvContextMenu → FolderContextMenu 수정 →
  FolderTree 수정 (DnD, dialogs)

[6단계] Tab 라우팅 + CsvPage 스캐폴드
  tab-url.ts 확장 → pane-routes.tsx → CsvPage (빈 뷰어)

[7단계] CSV 뷰어 기본
  CsvViewer → CsvTable (가상 스크롤) → papaparse 파싱 → readContent IPC

[8단계] CSV 편집
  CsvCell (인라인) → csv-history (undo/redo) → use-csv-editor → auto-save

[9단계] 뷰어 고급
  컬럼 정렬/필터/리사이즈 → CsvSearchBar (Ctrl+F) → CsvColumnHeader

[10단계] 외부 동기화
  own-write-tracker → use-csv-external-sync → 에디터 리마운트
```

---

## 1. DB Schema

### `src/main/db/schema/csv-file.ts` (신규)

```typescript
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { folders } from './folder'

export const csvFiles = sqliteTable(
  'csv_files',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    relativePath: text('relative_path').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    preview: text('preview').notNull().default(''),
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
import { csvFiles } from './csv-file'            // 추가
import { todos } from './todo'
import { appSettings } from './app-settings'

export { workspaces, tabSessions, tabSnapshots, folders, notes, csvFiles, todos, appSettings }
```

### 마이그레이션

```bash
npm run db:generate && npm run db:migrate
```

---

## 2. Repository

### `src/main/repositories/csv-file.ts` (신규)

```typescript
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { csvFiles } from '../db/schema'

export type CsvFile = typeof csvFiles.$inferSelect
export type CsvFileInsert = typeof csvFiles.$inferInsert

export const csvFileRepository = {
  findByWorkspaceId(workspaceId: string): CsvFile[] {
    return db.select().from(csvFiles).where(eq(csvFiles.workspaceId, workspaceId)).all()
  },

  findById(id: string): CsvFile | undefined {
    return db.select().from(csvFiles).where(eq(csvFiles.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): CsvFile | undefined {
    return db
      .select()
      .from(csvFiles)
      .where(and(eq(csvFiles.workspaceId, workspaceId), eq(csvFiles.relativePath, relativePath)))
      .get()
  },

  create(data: CsvFileInsert): CsvFile {
    return db.insert(csvFiles).values(data).returning().get()
  },

  createMany(items: CsvFileInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 99 // 10 columns × 99 = 990 < SQLite 999 limit
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(csvFiles).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<
        CsvFile,
        'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'
      >
    >
  ): CsvFile | undefined {
    return db.update(csvFiles).set(data).where(eq(csvFiles.id, id)).returning().get()
  },

  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(csvFiles).where(eq(csvFiles.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: csvFiles.id, relativePath: csvFiles.relativePath })
      .from(csvFiles)
      .where(eq(csvFiles.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(csvFiles).where(inArray(csvFiles.id, orphanIds.slice(i, i + CHUNK))).run()
    }
  },

  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE csv_files
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
      `UPDATE csv_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(csvFiles).where(eq(csvFiles.id, id)).run()
  }
}
```

---

## 3. 공유 유틸

### `src/main/lib/fs-utils.ts` 확장

기존 `readMdFilesRecursiveAsync` 바로 아래에 추가:

```typescript
export interface CsvFileEntry {
  name: string
  relativePath: string
}

export function readCsvFilesRecursive(absBase: string, parentRel: string): CsvFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: CsvFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readCsvFilesRecursive(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

export async function readCsvFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<CsvFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: CsvFileEntry[] = []
  const subDirPromises: Promise<CsvFileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      subDirPromises.push(readCsvFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  const subResults = await Promise.all(subDirPromises)
  return result.concat(...subResults)
}
```

### `src/main/lib/leaf-reindex.ts` (신규)

Note와 CSV가 같은 폴더 내에서 order를 공유하기 위한 혼합 reindex 유틸.

```typescript
import { db } from '../db'
import { noteRepository } from '../repositories/note'
import { csvFileRepository } from '../repositories/csv-file'

export interface LeafSibling {
  id: string
  kind: 'note' | 'csv'
  order: number
}

/**
 * 같은 폴더 내 모든 leaf siblings (note + csv) 조회, order 기준 정렬
 */
export function getLeafSiblings(
  workspaceId: string,
  folderId: string | null
): LeafSibling[] {
  const notes = noteRepository
    .findByWorkspaceId(workspaceId)
    .filter((n) => n.folderId === folderId)
    .map((n) => ({ id: n.id, kind: 'note' as const, order: n.order }))
  const csvs = csvFileRepository
    .findByWorkspaceId(workspaceId)
    .filter((c) => c.folderId === folderId)
    .map((c) => ({ id: c.id, kind: 'csv' as const, order: c.order }))
  return [...notes, ...csvs].sort((a, b) => a.order - b.order)
}

/**
 * 혼합 siblings를 한 트랜잭션 안에서 reindex
 * orderedItems: 최종 순서가 결정된 { id, kind } 배열
 */
export function reindexLeafSiblings(
  workspaceId: string,
  orderedItems: Array<{ id: string; kind: 'note' | 'csv' }>
): void {
  const now = Date.now()
  const noteStmt = db.$client.prepare(
    `UPDATE notes SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  const csvStmt = db.$client.prepare(
    `UPDATE csv_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  db.$client.transaction(() => {
    orderedItems.forEach((item, i) => {
      if (item.kind === 'note') {
        noteStmt.run(i, now, workspaceId, item.id)
      } else {
        csvStmt.run(i, now, workspaceId, item.id)
      }
    })
  })()
}
```

---

## 4. Service

### `src/main/services/csv-file.ts` (신규)

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import { NotFoundError, ValidationError } from '../lib/errors'
import { csvFileRepository } from '../repositories/csv-file'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readCsvFilesRecursive } from '../lib/fs-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'

export interface CsvFileNode {
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

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function parentRelPath(relativePath: string): string | null {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('/')
}

function toCsvFileNode(row: {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}): CsvFileNode {
  return {
    id: row.id,
    title: row.title,
    relativePath: row.relativePath,
    description: row.description,
    preview: row.preview,
    folderId: row.folderId,
    order: row.order,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)
  }
}

function generateCsvPreview(content: string): string {
  const lines = content.split('\n').slice(0, 3)
  return lines.join(' | ').slice(0, 200)
}

export const csvFileService = {
  /**
   * fs 스캔 + lazy upsert + orphan 삭제 → CsvFileNode[] 반환
   * workspace-watcher의 csvReconciliation에서만 호출
   */
  readByWorkspace(workspaceId: string): CsvFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    try {
      fs.accessSync(workspace.path)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspace.path}`)
    }

    const fsEntries = readCsvFilesRecursive(workspace.path, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbRows = csvFileRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbRows.map((r) => r.relativePath))

    const fsPathSet = new Set(fsPaths)
    const newFsEntries = fsEntries.filter((e) => !dbPathSet.has(e.relativePath))
    const orphanedRows = dbRows.filter((r) => !fsPathSet.has(r.relativePath))

    // 이동 감지: 새 경로와 orphan의 파일명이 같으면 이동으로 간주
    const orphanByBasename = new Map<string, (typeof orphanedRows)[0]>()
    for (const orphan of orphanedRows) {
      const basename = path.basename(orphan.relativePath)
      if (!orphanByBasename.has(basename)) orphanByBasename.set(basename, orphan)
    }

    const now = new Date()
    const toInsert: Parameters<typeof csvFileRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      if (matchedOrphan) {
        csvFileRepository.update(matchedOrphan.id, {
          relativePath: entry.relativePath,
          folderId: folder?.id ?? null,
          title: entry.name.replace(/\.csv$/, ''),
          updatedAt: now
        })
        orphanByBasename.delete(entry.name)
      } else {
        toInsert.push({
          id: nanoid(),
          workspaceId,
          folderId: folder?.id ?? null,
          relativePath: entry.relativePath,
          title: entry.name.replace(/\.csv$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }
    csvFileRepository.createMany(toInsert)
    csvFileRepository.deleteOrphans(workspaceId, fsPaths)

    return csvFileRepository.findByWorkspaceId(workspaceId).map(toCsvFileNode)
  },

  /**
   * DB-only 조회 (non-blocking). IPC 핸들러용.
   */
  readByWorkspaceFromDb(workspaceId: string): CsvFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return csvFileRepository.findByWorkspaceId(workspaceId).map(toCsvFileNode)
  },

  /**
   * CSV 생성 (disk + DB)
   */
  create(workspaceId: string, folderId: string | null, name: string): CsvFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    let folderRelPath: string | null = null
    if (folderId) {
      const folder = folderRepository.findById(folderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)
      folderRelPath = folder.relativePath
    }

    const parentAbs = folderRelPath ? path.join(workspace.path, folderRelPath) : workspace.path

    const desiredFileName = (name.trim() || '새로운 CSV') + '.csv'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.csv$/, '')

    const newAbs = path.join(parentAbs, finalFileName)
    const newRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )

    fs.writeFileSync(newAbs, '', 'utf-8')

    // maxOrder: note + csv 혼합 siblings에서 최대값
    const siblings = getLeafSiblings(workspaceId, folderId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = csvFileRepository.create({
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

    return toCsvFileNode(row)
  },

  /**
   * CSV 이름 변경 (disk + DB)
   */
  rename(workspaceId: string, csvId: string, newName: string): CsvFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    if (newName.trim() === csv.title) return toCsvFileNode(csv)

    const folderRel = parentRelPath(csv.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    const desiredFileName = newName.trim() + '.csv'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.csv$/, '')

    const oldAbs = path.join(workspace.path, csv.relativePath)
    const newRel = normalizePath(folderRel ? `${folderRel}/${finalFileName}` : finalFileName)
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)

    const updated = csvFileRepository.update(csvId, {
      relativePath: newRel,
      title,
      updatedAt: new Date()
    })!

    return toCsvFileNode(updated)
  },

  /**
   * CSV 삭제 (disk + DB)
   */
  remove(workspaceId: string, csvId: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    const absPath = path.join(workspace.path, csv.relativePath)
    try {
      fs.unlinkSync(absPath)
    } catch {
      // 이미 외부에서 삭제된 경우 무시
    }
    csvFileRepository.delete(csvId)
  },

  /**
   * CSV 내용 읽기 (인코딩 자동 감지)
   */
  readContent(workspaceId: string, csvId: string): { content: string; encoding: string } {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    const absPath = path.join(workspace.path, csv.relativePath)
    let rawBuffer: Buffer
    try {
      rawBuffer = fs.readFileSync(absPath)
    } catch {
      throw new NotFoundError(`파일을 읽을 수 없습니다: ${absPath}`)
    }

    // 빈 파일
    if (rawBuffer.length === 0) {
      return { content: '', encoding: 'UTF-8' }
    }

    const detected = chardet.detect(rawBuffer)
    const encoding = detected ?? 'UTF-8'

    let content = iconv.decode(rawBuffer, encoding)
    // BOM 제거
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1)
    }

    return { content, encoding }
  },

  /**
   * CSV 내용 저장 (항상 UTF-8) + preview 자동 업데이트
   */
  writeContent(workspaceId: string, csvId: string, content: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    const absPath = path.join(workspace.path, csv.relativePath)
    fs.writeFileSync(absPath, content, 'utf-8')

    const preview = generateCsvPreview(content)
    csvFileRepository.update(csvId, { preview, updatedAt: new Date() })
  },

  /**
   * CSV 이동 (DnD) — 다른 폴더로 이동 + 혼합 siblings reindex
   */
  move(
    workspaceId: string,
    csvId: string,
    targetFolderId: string | null,
    index: number
  ): CsvFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    let targetFolderRel: string | null = null
    if (targetFolderId) {
      const folder = folderRepository.findById(targetFolderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${targetFolderId}`)
      targetFolderRel = folder.relativePath
    }

    const csvFileName = csv.relativePath.split('/').at(-1)!
    const isSameFolder = csv.folderId === targetFolderId

    let finalRel = csv.relativePath
    let finalTitle = csv.title

    if (!isSameFolder) {
      const parentAbs = targetFolderRel
        ? path.join(workspace.path, targetFolderRel)
        : workspace.path
      const finalFileName = resolveNameConflict(parentAbs, csvFileName)
      finalTitle = finalFileName.replace(/\.csv$/, '')
      finalRel = normalizePath(
        targetFolderRel ? `${targetFolderRel}/${finalFileName}` : finalFileName
      )

      const oldAbs = path.join(workspace.path, csv.relativePath)
      const newAbs = path.join(workspace.path, finalRel)
      fs.renameSync(oldAbs, newAbs)

      csvFileRepository.update(csvId, {
        folderId: targetFolderId,
        relativePath: finalRel,
        title: finalTitle,
        updatedAt: new Date()
      })
    }

    // 혼합 siblings reindex (note + csv)
    const siblings = getLeafSiblings(workspaceId, targetFolderId)
    const withoutSelf = siblings.filter((s) => s.id !== csvId)
    withoutSelf.splice(index, 0, { id: csvId, kind: 'csv', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      withoutSelf.map((s) => ({ id: s.id, kind: s.kind }))
    )

    const updated = csvFileRepository.findById(csvId)!
    return toCsvFileNode(updated)
  },

  /**
   * 메타데이터 업데이트 (description)
   */
  updateMeta(_workspaceId: string, csvId: string, data: { description?: string }): CsvFileNode {
    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    const updated = csvFileRepository.update(csvId, {
      ...data,
      updatedAt: new Date()
    })!

    return toCsvFileNode(updated)
  }
}
```

---

## 5. 기존 noteService 수정

### `src/main/services/note.ts` — import 추가

```typescript
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'
```

### `noteService.create()` 수정

```diff
- const siblings = noteRepository
-   .findByWorkspaceId(workspaceId)
-   .filter((n) => n.folderId === folderId)
- const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
+ const siblings = getLeafSiblings(workspaceId, folderId)
+ const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
```

### `noteService.move()` 수정

```diff
- // siblings reindex (항상 실행)
- const siblings = noteRepository
-   .findByWorkspaceId(workspaceId)
-   .filter((n) => n.folderId === targetFolderId)
-   .sort((a, b) => a.order - b.order)
-
- const withoutSelf = siblings.filter((n) => n.id !== noteId)
- withoutSelf.splice(index, 0, { ...note, folderId: targetFolderId, relativePath: finalRel })
- noteRepository.reindexSiblings(
-   workspaceId,
-   withoutSelf.map((n) => n.id)
- )
+ // 혼합 siblings reindex (note + csv)
+ const siblings = getLeafSiblings(workspaceId, targetFolderId)
+ const withoutSelf = siblings.filter((s) => s.id !== noteId)
+ withoutSelf.splice(index, 0, { id: noteId, kind: 'note', order: 0 })
+ reindexLeafSiblings(
+   workspaceId,
+   withoutSelf.map((s) => ({ id: s.id, kind: s.kind }))
+ )
```

---

## 6. IPC Handler

### `src/main/ipc/csv-file.ts` (신규)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { csvFileService } from '../services/csv-file'

export function registerCsvHandlers(): void {
  ipcMain.handle(
    'csv:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => csvFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'csv:create',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      name: string
    ): IpcResponse => handle(() => csvFileService.create(workspaceId, folderId, name))
  )

  ipcMain.handle(
    'csv:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string, newName: string): IpcResponse =>
      handle(() => csvFileService.rename(workspaceId, csvId, newName))
  )

  ipcMain.handle(
    'csv:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string): IpcResponse =>
      handle(() => csvFileService.remove(workspaceId, csvId))
  )

  ipcMain.handle(
    'csv:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string): IpcResponse =>
      handle(() => csvFileService.readContent(workspaceId, csvId))
  )

  ipcMain.handle(
    'csv:writeContent',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string, content: string): IpcResponse =>
      handle(() => csvFileService.writeContent(workspaceId, csvId, content))
  )

  ipcMain.handle(
    'csv:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      csvId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => csvFileService.move(workspaceId, csvId, folderId, index))
  )

  ipcMain.handle(
    'csv:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      csvId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => csvFileService.updateMeta(workspaceId, csvId, data))
  )
}
```

### `src/main/index.ts` 수정

```typescript
import { registerCsvHandlers } from './ipc/csv-file'  // 추가

// app.whenReady() 내부, registerNoteHandlers() 바로 아래:
registerCsvHandlers()
```

---

## 7. Workspace Watcher 확장

### `src/main/services/workspace-watcher.ts` 수정

#### import 추가

```typescript
import { csvFileRepository } from '../repositories/csv-file'
import { readCsvFilesRecursiveAsync } from '../lib/fs-utils'
```

#### Step 1 폴더 감지 필터 수정

```diff
- const nonMdDeletes = events.filter(
-   (e) =>
-     e.type === 'delete' && !e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
- )
- const nonMdCreates = events.filter(
-   (e) =>
-     e.type === 'create' && !e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
- )
+ const folderDeletes = events.filter(
+   (e) =>
+     e.type === 'delete'
+     && !e.path.endsWith('.md')
+     && !e.path.endsWith('.csv')
+     && !path.basename(e.path).startsWith('.')
+ )
+ const folderCreates = events.filter(
+   (e) =>
+     e.type === 'create'
+     && !e.path.endsWith('.md')
+     && !e.path.endsWith('.csv')
+     && !path.basename(e.path).startsWith('.')
+ )
```

> 이후 로직의 `nonMdDeletes` → `folderDeletes`, `nonMdCreates` → `folderCreates` 치환.

#### Step 2 폴더 이벤트 루프에 `.csv` skip 추가

기존 `if (absPath.endsWith('.md')) continue` 바로 아래에:

```diff
  if (absPath.endsWith('.md')) continue
+ if (absPath.endsWith('.csv')) continue
  if (pairedFolderDeletePaths.has(absPath) || pairedFolderCreatePaths.has(absPath)) continue
```

#### `oldPath` 분기에 csv bulkUpdatePathPrefix 추가

```diff
  if ('oldPath' in event && typeof (event as unknown as { oldPath: string }).oldPath === 'string') {
    const oldRel = path
      .relative(workspacePath, (event as unknown as { oldPath: string }).oldPath)
      .replace(/\\/g, '/')
    folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
    noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
+   csvFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
    continue
  }
```

#### Step 3~5 이후: `.csv` 파일 처리 추가

기존 `.md` 파일 Step 3~5 아래에 동일 패턴으로 `.csv` Step 추가:

```typescript
// ─── Step 6: .csv 파일 rename/move 감지 ───────────────────────
const csvDeletes = events.filter(
  (e) => e.type === 'delete' && e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.')
)
const csvCreates = events.filter(
  (e) => e.type === 'create' && e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.')
)
const pairedCsvDeletePaths = new Set<string>()
const pairedCsvCreatePaths = new Set<string>()
for (const createEvent of csvCreates) {
  const createDir = path.dirname(createEvent.path)
  const createBasename = path.basename(createEvent.path)
  const matchingDelete =
    csvDeletes.find(
      (d) => !pairedCsvDeletePaths.has(d.path) && path.dirname(d.path) === createDir
    ) ??
    csvDeletes.find(
      (d) => !pairedCsvDeletePaths.has(d.path) && path.basename(d.path) === createBasename
    )
  if (matchingDelete) {
    const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
    const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
    const existing = csvFileRepository.findByRelativePath(workspaceId, oldRel)
    if (existing) {
      const newParentRel = newRel.includes('/')
        ? newRel.split('/').slice(0, -1).join('/')
        : null
      const newFolder = newParentRel
        ? folderRepository.findByRelativePath(workspaceId, newParentRel)
        : null
      csvFileRepository.update(existing.id, {
        relativePath: newRel,
        folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
        title: path.basename(createEvent.path, '.csv'),
        updatedAt: new Date()
      })
      pairedCsvDeletePaths.add(matchingDelete.path)
      pairedCsvCreatePaths.add(createEvent.path)
    }
  }
}

// ─── Step 7: standalone .csv create → DB 추가 ──────────
for (const createEvent of csvCreates) {
  if (pairedCsvCreatePaths.has(createEvent.path)) continue
  const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
  const existing = csvFileRepository.findByRelativePath(workspaceId, rel)
  if (!existing) {
    try {
      const stat = await fs.promises.stat(createEvent.path)
      if (!stat.isFile()) continue
    } catch {
      continue
    }
    const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
    const folder = parentRel
      ? folderRepository.findByRelativePath(workspaceId, parentRel)
      : null
    const now = new Date()
    csvFileRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: rel,
      folderId: folder?.id ?? null,
      title: path.basename(createEvent.path, '.csv'),
      description: '',
      preview: '',
      order: 0,
      createdAt: now,
      updatedAt: now
    })
  }
}

// ─── Step 8: standalone .csv delete → DB 삭제 ──────────
for (const deleteEvent of csvDeletes) {
  if (pairedCsvDeletePaths.has(deleteEvent.path)) continue
  const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
  const existing = csvFileRepository.findByRelativePath(workspaceId, rel)
  if (existing) {
    csvFileRepository.delete(existing.id)
  }
}
```

#### handleEvents 확장

```typescript
private handleEvents(workspaceId: string, workspacePath: string, events: parcelWatcher.Event[]): void {
  this.pendingEvents.push(...events)
  if (this.debounceTimer) clearTimeout(this.debounceTimer)
  this.debounceTimer = setTimeout(async () => {
    try {
      const eventsToProcess = this.pendingEvents.splice(0)
      await this.applyEvents(workspaceId, workspacePath, eventsToProcess)
      this.pushFolderChanged(workspaceId)

      // .md
      const changedMdRelPaths = eventsToProcess
        .filter((e) => e.path.endsWith('.md') && !path.basename(e.path).startsWith('.'))
        .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/'))
      this.pushNoteChanged(workspaceId, changedMdRelPaths)

      // .csv (추가)
      const changedCsvRelPaths = eventsToProcess
        .filter((e) => e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.'))
        .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/'))
      this.pushCsvChanged(workspaceId, changedCsvRelPaths)
    } catch {
      /* ignore */
    }
  }, 50)
}
```

#### csvReconciliation + pushCsvChanged 추가

```typescript
private async csvReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
  const fsEntries = await readCsvFilesRecursiveAsync(workspacePath, '')
  const fsPaths = fsEntries.map((e) => e.relativePath)

  const dbRows = csvFileRepository.findByWorkspaceId(workspaceId)
  const dbPathSet = new Set(dbRows.map((r) => r.relativePath))

  const now = new Date()
  const toInsert = fsEntries
    .filter((e) => !dbPathSet.has(e.relativePath))
    .map((e) => {
      const parentRel = e.relativePath.includes('/')
        ? e.relativePath.split('/').slice(0, -1).join('/')
        : null
      const folder = parentRel
        ? folderRepository.findByRelativePath(workspaceId, parentRel)
        : null
      return {
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        folderId: folder?.id ?? null,
        title: e.name.replace(/\.csv$/, ''),
        description: '',
        preview: '',
        order: 0,
        createdAt: now,
        updatedAt: now
      }
    })

  csvFileRepository.createMany(toInsert)
  csvFileRepository.deleteOrphans(workspaceId, fsPaths)
}

private pushCsvChanged(workspaceId: string, changedRelPaths: string[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('csv:changed', workspaceId, changedRelPaths)
  })
}
```

#### start() 메서드 확장

```typescript
async start(workspaceId: string, workspacePath: string): Promise<void> {
  await this.syncOfflineChanges(workspaceId, workspacePath)

  try { await this.noteReconciliation(workspaceId, workspacePath) } catch { /* ignore */ }
  try { await this.csvReconciliation(workspaceId, workspacePath) } catch { /* ignore */ }  // 추가

  this.pushFolderChanged(workspaceId)
  this.pushNoteChanged(workspaceId, [])
  this.pushCsvChanged(workspaceId, [])  // 추가

  // ... subscription 등록 ...
}
```

#### Step 1 폴더 bulkUpdatePathPrefix에 csv도 추가

```diff
  if (existingFolder) {
    folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
    noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
+   csvFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
    pairedFolderDeletePaths.add(matchingDelete.path)
    pairedFolderCreatePaths.add(createEvent.path)
  }
```

---

## 8. Preload

### `src/preload/index.d.ts` 추가

```typescript
interface CsvFileNode {
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

interface CsvAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<CsvFileNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<CsvFileNode>>
  rename: (
    workspaceId: string,
    csvId: string,
    newName: string
  ) => Promise<IpcResponse<CsvFileNode>>
  remove: (workspaceId: string, csvId: string) => Promise<IpcResponse<void>>
  readContent: (
    workspaceId: string,
    csvId: string
  ) => Promise<IpcResponse<{ content: string; encoding: string }>>
  writeContent: (
    workspaceId: string,
    csvId: string,
    content: string
  ) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    csvId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<CsvFileNode>>
  updateMeta: (
    workspaceId: string,
    csvId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<CsvFileNode>>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

// API 인터페이스에 추가:
interface API {
  note: NoteAPI
  folder: FolderAPI
  csv: CsvAPI          // 추가
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  todo: TodoAPI
  settings: SettingsAPI
}
```

### `src/preload/index.ts` 추가

`note:` 섹션 바로 아래에:

```typescript
csv: {
  readByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('csv:readByWorkspace', workspaceId),
  create: (workspaceId: string, folderId: string | null, name: string) =>
    ipcRenderer.invoke('csv:create', workspaceId, folderId, name),
  rename: (workspaceId: string, csvId: string, newName: string) =>
    ipcRenderer.invoke('csv:rename', workspaceId, csvId, newName),
  remove: (workspaceId: string, csvId: string) =>
    ipcRenderer.invoke('csv:remove', workspaceId, csvId),
  readContent: (workspaceId: string, csvId: string) =>
    ipcRenderer.invoke('csv:readContent', workspaceId, csvId),
  writeContent: (workspaceId: string, csvId: string, content: string) =>
    ipcRenderer.invoke('csv:writeContent', workspaceId, csvId, content),
  move: (workspaceId: string, csvId: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke('csv:move', workspaceId, csvId, folderId, index),
  updateMeta: (workspaceId: string, csvId: string, data: { description?: string }) =>
    ipcRenderer.invoke('csv:updateMeta', workspaceId, csvId, data),
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      workspaceId: string,
      changedRelPaths: string[]
    ): void => callback(workspaceId, changedRelPaths)
    ipcRenderer.on('csv:changed', handler)
    return () => ipcRenderer.removeListener('csv:changed', handler)
  }
},
```

---

## 9. Renderer — Entity

### `src/renderer/src/entities/csv-file/model/types.ts`

```typescript
export interface CsvFileNode {
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

### `src/renderer/src/entities/csv-file/model/own-write-tracker.ts`

```typescript
const pendingWrites = new Set<string>()

export function markAsOwnWrite(csvId: string): void {
  pendingWrites.add(csvId)
  setTimeout(() => pendingWrites.delete(csvId), 2000)
}

export function isOwnWrite(csvId: string): boolean {
  return pendingWrites.has(csvId)
}
```

### `src/renderer/src/entities/csv-file/model/use-csv-watcher.ts`

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CsvFileNode } from './types'
import { isOwnWrite } from './own-write-tracker'

export const CSV_EXTERNAL_CHANGED_EVENT = 'csv:external-changed'

export function useCsvWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.csv.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      queryClient.invalidateQueries({ queryKey: ['csv', 'workspace', workspaceId] })

      const csvFiles = queryClient.getQueryData<CsvFileNode[]>([
        'csv',
        'workspace',
        workspaceId
      ])
      if (csvFiles && changedRelPaths.length > 0) {
        csvFiles
          .filter((c) => changedRelPaths.includes(c.relativePath) && !isOwnWrite(c.id))
          .forEach((c) => {
            queryClient.refetchQueries({ queryKey: ['csv', 'content', c.id] }).then(() => {
              window.dispatchEvent(
                new CustomEvent(CSV_EXTERNAL_CHANGED_EVENT, { detail: { csvId: c.id } })
              )
            })
          })
      }
    })
    return unsub
  }, [queryClient])
}
```

### `src/renderer/src/entities/csv-file/api/queries.ts`

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
import type { CsvFileNode } from '../model/types'
import { markAsOwnWrite } from '../model/own-write-tracker'

const CSV_KEY = 'csv'

export function useCsvFilesByWorkspace(workspaceId: string): UseQueryResult<CsvFileNode[]> {
  return useQuery({
    queryKey: [CSV_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<CsvFileNode[]> => {
      const res: IpcResponse<CsvFileNode[]> = await window.api.csv.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateCsv(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; name: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId, name }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.create(
        workspaceId,
        folderId,
        name
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenameCsv(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; csvId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, csvId, newName }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.rename(
        workspaceId,
        csvId,
        newName
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveCsv(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; csvId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, csvId }) => {
      const res: IpcResponse<void> = await window.api.csv.remove(workspaceId, csvId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadCsvContent(
  workspaceId: string,
  csvId: string
): UseQueryResult<{ content: string; encoding: string }> {
  return useQuery({
    queryKey: [CSV_KEY, 'content', csvId],
    queryFn: async () => {
      const res: IpcResponse<{ content: string; encoding: string }> =
        await window.api.csv.readContent(workspaceId, csvId)
      if (!res.success) throwIpcError(res)
      return res.data ?? { content: '', encoding: 'UTF-8' }
    },
    enabled: !!workspaceId && !!csvId,
    staleTime: Infinity
  })
}

export function useWriteCsvContent(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; csvId: string; content: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ csvId }) => {
      markAsOwnWrite(csvId)
    },
    mutationFn: async ({ workspaceId, csvId, content }) => {
      const res: IpcResponse<void> = await window.api.csv.writeContent(
        workspaceId,
        csvId,
        content
      )
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { csvId, content }) => {
      // content cache를 직접 업데이트 (refetch 불필요)
      queryClient.setQueryData([CSV_KEY, 'content', csvId], (prev: { content: string; encoding: string } | undefined) => ({
        content,
        encoding: prev?.encoding ?? 'UTF-8'
      }))
    }
  })
}

export function useMoveCsv(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; csvId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, csvId, folderId, index }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.move(
        workspaceId,
        csvId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
      // note order도 변경될 수 있으므로 같이 invalidate
      queryClient.invalidateQueries({ queryKey: ['note', 'workspace', workspaceId] })
    }
  })
}

export function useUpdateCsvMeta(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; csvId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, csvId, data }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.updateMeta(
        workspaceId,
        csvId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}
```

### `src/renderer/src/entities/csv-file/index.ts`

```typescript
export type { CsvFileNode } from './model/types'
export {
  useCsvFilesByWorkspace,
  useCreateCsv,
  useRenameCsv,
  useRemoveCsv,
  useMoveCsv,
  useReadCsvContent,
  useWriteCsvContent,
  useUpdateCsvMeta
} from './api/queries'
export { useCsvWatcher } from './model/use-csv-watcher'
```

---

## 10. MainLayout 등록

### `src/renderer/src/app/layout/MainLayout.tsx` 수정

```diff
  import { useFolderWatcher } from '@entities/folder'
  import { useNoteWatcher } from '@entities/note'
+ import { useCsvWatcher } from '@entities/csv-file'

  function MainLayout(): React.JSX.Element {
    useSessionPersistence()
    useFolderWatcher()
    useNoteWatcher()
+   useCsvWatcher()
    // ...
  }
```

---

## 11. Tab 라우팅 + 상수

### `src/renderer/src/shared/constants/tab-url.ts` 수정

```diff
- import { Calendar, Check, FileText, FolderOpen, LayoutDashboard } from 'lucide-react'
+ import { Calendar, Check, FileText, FolderOpen, LayoutDashboard, Sheet } from 'lucide-react'

- export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'calendar'
+ export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'calendar'

  export const TAB_ICON: Record<TabIcon, React.ElementType> = {
    dashboard: LayoutDashboard,
    todo: Check,
    'todo-detail': Check,
    folder: FolderOpen,
    note: FileText,
+   csv: Sheet,
    calendar: Calendar
  }

  export const ROUTES = {
    DASHBOARD: '/dashboard',
    TODO: '/todo',
    TODO_DETAIL: '/todo/:todoId',
    FOLDER: '/folder',
    SETTINGS: '/settings',
    NOTE_DETAIL: '/folder/note/:noteId',
+   CSV_DETAIL: '/folder/csv/:csvId',
    CALENDAR: '/calendar'
  } as const
```

### `src/renderer/src/app/layout/model/pane-routes.tsx` 수정

```diff
  const NotePage = lazy(() => import('@pages/note'))
+ const CsvPage = lazy(() => import('@pages/csv'))

  export const PANE_ROUTES: PaneRoute[] = [
    { pattern: ROUTES.DASHBOARD,    component: DashboardPage },
    { pattern: ROUTES.TODO,         component: TodoPage },
    { pattern: ROUTES.TODO_DETAIL,  component: TodoDetailPage },
    { pattern: ROUTES.FOLDER,       component: FolderPage },
    { pattern: ROUTES.NOTE_DETAIL,  component: NotePage },
+   { pattern: ROUTES.CSV_DETAIL,   component: CsvPage },
  ]
```

---

## 12. FolderTree 확장

### `src/renderer/src/features/folder/manage-folder/model/types.ts` 수정

```typescript
// 기존 타입 아래에 추가:
export interface CsvTreeNode {
  kind: 'csv'
  id: string
  name: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
}

// WorkspaceTreeNode 수정:
export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode
```

### `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` 수정

```diff
  import { useFolderTree } from '@entities/folder'
  import type { FolderNode } from '@entities/folder'
  import { useNotesByWorkspace } from '@entities/note'
  import type { NoteNode } from '@entities/note'
- import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode } from './types'
+ import { useCsvFilesByWorkspace } from '@entities/csv-file'
+ import type { CsvFileNode } from '@entities/csv-file'
+ import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode, CsvTreeNode } from './types'
```

`buildWorkspaceTree` 함수에 `csvFiles` 매개변수 추가 + 혼합 정렬:

```typescript
export function buildWorkspaceTree(
  folders: FolderNode[],
  notes: NoteNode[],
  csvFiles: CsvFileNode[]
): WorkspaceTreeNode[] {
  function convertNote(note: NoteNode): NoteTreeNode { /* 기존 동일 */ }

  function convertCsv(csv: CsvFileNode): CsvTreeNode {
    return {
      kind: 'csv',
      id: csv.id,
      name: csv.title,
      relativePath: csv.relativePath,
      description: csv.description,
      preview: csv.preview,
      folderId: csv.folderId,
      order: csv.order
    }
  }

  function convertFolder(folder: FolderNode): FolderTreeNode {
    const childFolders = folder.children
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(convertFolder)

    // Note + CSV 혼합 정렬
    const childNotes = notes.filter((n) => n.folderId === folder.id).map(convertNote)
    const childCsvs = csvFiles.filter((c) => c.folderId === folder.id).map(convertCsv)
    const leafChildren = [...childNotes, ...childCsvs]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

    return {
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      relativePath: folder.relativePath,
      color: folder.color,
      order: folder.order,
      children: [...childFolders, ...leafChildren]
    }
  }

  const rootFolders = folders
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(convertFolder)

  const rootLeaves = [
    ...notes.filter((n) => n.folderId === null).map(convertNote),
    ...csvFiles.filter((c) => c.folderId === null).map(convertCsv)
  ].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

  return [...rootFolders, ...rootLeaves]
}

export function useWorkspaceTree(workspaceId: string): {
  tree: WorkspaceTreeNode[]
  isLoading: boolean
} {
  const { data: folders = [], isLoading: isFoldersLoading } = useFolderTree(workspaceId)
  const { data: notes = [], isLoading: isNotesLoading } = useNotesByWorkspace(workspaceId)
  const { data: csvFiles = [], isLoading: isCsvLoading } = useCsvFilesByWorkspace(workspaceId)

  const tree = buildWorkspaceTree(folders, notes, csvFiles)

  return {
    tree,
    isLoading: isFoldersLoading || isNotesLoading || isCsvLoading
  }
}
```

### `src/renderer/src/features/folder/manage-folder/ui/CsvNodeRenderer.tsx` (신규)

```typescript
import { Sheet } from 'lucide-react'
import type { NodeRendererProps } from 'react-arborist'
import type { CsvTreeNode } from '../model/types'

interface CsvNodeRendererProps extends NodeRendererProps<CsvTreeNode> {
  onOpen: () => void
}

export function CsvNodeRenderer({
  node,
  style,
  dragHandle,
  onOpen
}: CsvNodeRendererProps): React.ReactElement {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <Sheet className="ml-1 size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

### `src/renderer/src/features/folder/manage-folder/ui/CsvContextMenu.tsx` (신규)

```typescript
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

export function CsvContextMenu({ children, onRename, onDelete }: Props): React.ReactElement {
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

```diff
  interface Props {
    children: React.ReactNode
    onCreateChild: () => void
    onCreateNote: () => void
+   onCreateCsv: () => void
    onRename: () => void
    onEditColor: () => void
    onDelete: () => void
  }

  // 메뉴 항목에 "노트 추가하기" 바로 아래에 추가:
+ <ContextMenuItem onClick={onCreateCsv}>
+   <Sheet className="size-4 mr-2" />
+   CSV 추가하기
+ </ContextMenuItem>
```

### `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx` 수정 요약

1. **import 추가**: `useCreateCsv`, `useMoveCsv`, `useRemoveCsv`, `useRenameCsv` from `@entities/csv-file`
2. **mutation hooks 추가**: `const { mutate: createCsv } = useCreateCsv()` 등
3. **state 추가**: `csvRenameTarget`, `csvDeleteTarget` (기존 `noteDeleteTarget` 패턴)
4. **handleCreateCsv 콜백**: `createCsv({ workspaceId, folderId, name: '새로운 CSV' }, { onSuccess: (csv) => openRightTab({ type: 'csv', ... }) })`
5. **Tree `disableDrop`**: `parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv'`
6. **Tree `disableEdit`**: `n.kind === 'note' || n.kind === 'csv'`
7. **Tree `onDelete`**: `kind === 'csv'` 분기 추가
8. **Tree `onMove`**: `kind === 'csv'` 분기 → `moveCsv()` 호출
9. **NodeRenderer에 csv 분기 추가**: `CsvContextMenu` + `CsvNodeRenderer`
10. **FolderContextMenu에 `onCreateCsv` prop 전달**
11. **다이얼로그 추가**: CSV rename (FolderNameDialog 재사용), CSV delete (DeleteFolderDialog 재사용)
12. **툴바에 CSV 추가 버튼**: `<Sheet />` 아이콘 + `onClick={() => handleCreateCsv(null)}`

---

## 13. CsvPage

### `src/renderer/src/pages/csv/ui/CsvPage.tsx` (신규)

```typescript
import { JSX, useEffect } from 'react'
import { useReadCsvContent } from '@entities/csv-file'
import { TabContainer } from '@shared/ui/tab-container'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { CsvViewer } from '@features/csv-viewer'

// @app import 대신 인라인 타입 (FSD 위반 방지: pages → app 금지)
export function CsvPage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const csvId = params?.csvId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)
  const { data, isLoading, isError } = useReadCsvContent(workspaceId, csvId)

  useEffect(() => {
    if (tabId && isError) setTabError(tabId, true)
  }, [isError, tabId, setTabError])

  if (!csvId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">CSV 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  if (isLoading) {
    return (
      <TabContainer header={null}>
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          로딩 중...
        </div>
      </TabContainer>
    )
  }

  if (isError) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-destructive p-4">파일을 읽을 수 없습니다.</div>
      </TabContainer>
    )
  }

  return (
    <TabContainer header={null} scrollable={false}>
      <CsvViewer
        workspaceId={workspaceId}
        csvId={csvId}
        initialContent={data?.content ?? ''}
        encoding={data?.encoding ?? 'UTF-8'}
      />
    </TabContainer>
  )
}
```

> `scrollable={false}` — CsvTable이 자체 가상 스크롤을 사용하므로 TabContainer의 ScrollArea 비활성화.

### `src/renderer/src/pages/csv/index.ts`

```typescript
export { CsvPage } from './ui/CsvPage'
export { CsvPage as default } from './ui/CsvPage'
```

---

## 14. CSV 뷰어/에디터

### `src/renderer/src/features/csv-viewer/model/types.ts`

```typescript
export type CsvCommand =
  | { type: 'editCell'; row: number; col: number; oldValue: string; newValue: string }
  | { type: 'addRow'; index: number; row: string[] }
  | { type: 'deleteRow'; index: number; row: string[] }
  | { type: 'addColumn'; index: number; name: string }
  | { type: 'deleteColumn'; index: number; name: string; columnData: string[] }
  | { type: 'renameColumn'; index: number; oldName: string; newName: string }

export interface CsvEditorState {
  headers: string[]
  rows: string[][]
  isDirty: boolean
  modifiedCells: Set<string>  // key: `${rowIdx}-${colIdx}`
}
```

### `src/renderer/src/features/csv-viewer/model/csv-history.ts`

```typescript
import type { CsvCommand } from './types'

export class CsvHistory {
  private undoStack: CsvCommand[] = []
  private redoStack: CsvCommand[] = []

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  push(command: CsvCommand): void {
    this.undoStack.push(command)
    this.redoStack = [] // 새 커맨드 → redo 스택 초기화
  }

  undo(): CsvCommand | undefined {
    const cmd = this.undoStack.pop()
    if (cmd) this.redoStack.push(cmd)
    return cmd
  }

  redo(): CsvCommand | undefined {
    const cmd = this.redoStack.pop()
    if (cmd) this.undoStack.push(cmd)
    return cmd
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
```

> **own-write-tracker**: `entities/csv-file/model/own-write-tracker.ts`만 사용. features 레벨에서는 `@entities/csv-file`의 `markAsOwnWrite`/`isOwnWrite`를 직접 import. (FSD: 하위 레이어 → 상위 레이어 중복 금지)

### `src/renderer/src/features/csv-viewer/model/use-csv-external-sync.ts`

```typescript
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CSV_EXTERNAL_CHANGED_EVENT } from '@entities/csv-file/model/use-csv-watcher'

export function useCsvExternalSync(
  csvId: string
): { editorKey: number; latestContent: string | null } {
  const [editorKey, setEditorKey] = useState(0)
  const [latestContent, setLatestContent] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const handler = (e: Event): void => {
      if ((e as CustomEvent<{ csvId: string }>).detail.csvId === csvId) {
        const cached = queryClient.getQueryData<{ content: string; encoding: string }>([
          'csv',
          'content',
          csvId
        ])
        setLatestContent(cached?.content ?? null)
        setEditorKey((k) => k + 1)
      }
    }
    window.addEventListener(CSV_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(CSV_EXTERNAL_CHANGED_EVENT, handler)
  }, [csvId, queryClient])

  return { editorKey, latestContent }
}
```

### `src/renderer/src/features/csv-viewer/model/use-csv-editor.ts` (핵심 훅)

```typescript
import { useState, useRef, useCallback, useEffect } from 'react'
import Papa from 'papaparse'
import { useWriteCsvContent } from '@entities/csv-file'
import { CsvHistory } from './csv-history'
import type { CsvCommand, CsvEditorState } from './types'

export function useCsvEditor(
  workspaceId: string,
  csvId: string,
  initialContent: string
) {
  const historyRef = useRef(new CsvHistory())
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const { mutate: writeCsvContent } = useWriteCsvContent()

  // 파싱
  const parsed = Papa.parse<string[]>(initialContent, { header: false, skipEmptyLines: true })
  const initHeaders = parsed.data.length > 0 ? parsed.data[0] : []
  const initRows = parsed.data.length > 1 ? parsed.data.slice(1) : []

  const [headers, setHeaders] = useState<string[]>(initHeaders)
  const [rows, setRows] = useState<string[][]>(initRows)
  const [modifiedCells, setModifiedCells] = useState<Set<string>>(new Set())

  // debounced auto-save (NoteEditor.tsx와 동일한 수동 debounce 패턴)
  const triggerSave = useCallback(
    (h: string[], r: string[][]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const csv = Papa.unparse({ fields: h, data: r })
        writeCsvContent({ workspaceId, csvId, content: csv })
        setModifiedCells(new Set()) // 저장 완료 → 하이라이트 제거
      }, 800)
    },
    [workspaceId, csvId, writeCsvContent]
  )

  // command 실행
  const executeCommand = useCallback(
    (cmd: CsvCommand) => {
      historyRef.current.push(cmd)
      applyCommand(cmd, headers, rows, setHeaders, setRows, setModifiedCells)
      // 변경 후 save 트리거는 state 업데이트 후 effect에서 처리
    },
    [headers, rows]
  )

  // headers/rows 변경 시 auto-save
  useEffect(() => {
    if (modifiedCells.size > 0) {
      triggerSave(headers, rows)
    }
  }, [headers, rows, modifiedCells, triggerSave])

  // undo/redo
  const undo = useCallback(() => {
    const cmd = historyRef.current.undo()
    if (cmd) reverseCommand(cmd, headers, rows, setHeaders, setRows, setModifiedCells)
  }, [headers, rows])

  const redo = useCallback(() => {
    const cmd = historyRef.current.redo()
    if (cmd) applyCommand(cmd, headers, rows, setHeaders, setRows, setModifiedCells)
  }, [headers, rows])

  // 언마운트 시 debounce 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // 외부 변경으로 리마운트 시 히스토리 초기화
  const resetWithContent = useCallback((newContent: string) => {
    const p = Papa.parse<string[]>(newContent, { header: false, skipEmptyLines: true })
    setHeaders(p.data.length > 0 ? p.data[0] : [])
    setRows(p.data.length > 1 ? p.data.slice(1) : [])
    setModifiedCells(new Set())
    historyRef.current.clear()
  }, [])

  return {
    headers,
    rows,
    modifiedCells,
    executeCommand,
    undo,
    redo,
    canUndo: historyRef.current.canUndo,
    canRedo: historyRef.current.canRedo,
    resetWithContent
  }
}

// 커맨드 적용 함수 (별도 분리)
function applyCommand(
  cmd: CsvCommand,
  _headers: string[],
  _rows: string[][],
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>,
  setRows: React.Dispatch<React.SetStateAction<string[][]>>,
  setModifiedCells: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  switch (cmd.type) {
    case 'editCell':
      setRows((prev) => {
        const next = prev.map((r) => [...r])
        next[cmd.row][cmd.col] = cmd.newValue
        return next
      })
      setModifiedCells((prev) => new Set(prev).add(`${cmd.row}-${cmd.col}`))
      break
    case 'addRow':
      setRows((prev) => {
        const next = [...prev]
        next.splice(cmd.index, 0, cmd.row)
        return next
      })
      setModifiedCells((prev) => new Set(prev).add(`row-${cmd.index}`))
      break
    case 'deleteRow':
      setRows((prev) => prev.filter((_, i) => i !== cmd.index))
      setModifiedCells((prev) => new Set(prev).add('structure'))
      break
    case 'addColumn':
      setHeaders((prev) => {
        const next = [...prev]
        next.splice(cmd.index, 0, cmd.name)
        return next
      })
      setRows((prev) => prev.map((r) => {
        const next = [...r]
        next.splice(cmd.index, 0, '')
        return next
      }))
      setModifiedCells((prev) => new Set(prev).add('structure'))
      break
    case 'deleteColumn':
      setHeaders((prev) => prev.filter((_, i) => i !== cmd.index))
      setRows((prev) => prev.map((r) => r.filter((_, i) => i !== cmd.index)))
      setModifiedCells((prev) => new Set(prev).add('structure'))
      break
    case 'renameColumn':
      setHeaders((prev) => {
        const next = [...prev]
        next[cmd.index] = cmd.newName
        return next
      })
      setModifiedCells((prev) => new Set(prev).add(`header-${cmd.index}`))
      break
  }
}

function reverseCommand(
  cmd: CsvCommand,
  headers: string[],
  rows: string[][],
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>,
  setRows: React.Dispatch<React.SetStateAction<string[][]>>,
  setModifiedCells: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  switch (cmd.type) {
    case 'editCell':
      applyCommand(
        { ...cmd, newValue: cmd.oldValue, oldValue: cmd.newValue },
        headers, rows, setHeaders, setRows, setModifiedCells
      )
      break
    case 'addRow':
      applyCommand(
        { type: 'deleteRow', index: cmd.index, row: cmd.row },
        headers, rows, setHeaders, setRows, setModifiedCells
      )
      break
    case 'deleteRow':
      applyCommand(
        { type: 'addRow', index: cmd.index, row: cmd.row },
        headers, rows, setHeaders, setRows, setModifiedCells
      )
      break
    case 'addColumn':
      applyCommand(
        { type: 'deleteColumn', index: cmd.index, name: cmd.name, columnData: [] },
        headers, rows, setHeaders, setRows, setModifiedCells
      )
      break
    case 'deleteColumn':
      applyCommand(
        { type: 'addColumn', index: cmd.index, name: cmd.name },
        headers, rows, setHeaders, setRows, setModifiedCells
      )
      // 삭제된 열 데이터 복원
      setRows((prev) => prev.map((r, rowIdx) => {
        const next = [...r]
        next.splice(cmd.index, 0, cmd.columnData[rowIdx] ?? '')
        return next
      }))
      break
    case 'renameColumn':
      applyCommand(
        { ...cmd, oldName: cmd.newName, newName: cmd.oldName },
        headers, rows, setHeaders, setRows, setModifiedCells
      )
      break
  }
}
```

### `src/renderer/src/features/csv-viewer/ui/CsvViewer.tsx`

```typescript
import { useState, useEffect } from 'react'
import { useCsvEditor } from '../model/use-csv-editor'
import { useCsvExternalSync } from '../model/use-csv-external-sync'
import { CsvToolbar } from './CsvToolbar'
import { CsvTable } from './CsvTable'
import { CsvSearchBar } from './CsvSearchBar'

interface CsvViewerProps {
  workspaceId: string
  csvId: string
  initialContent: string
  encoding: string
}

export function CsvViewer({
  workspaceId,
  csvId,
  initialContent,
  encoding
}: CsvViewerProps): React.ReactElement {
  const { editorKey, latestContent } = useCsvExternalSync(csvId)
  const content = latestContent ?? initialContent

  const editor = useCsvEditor(workspaceId, csvId, content)
  const [searchOpen, setSearchOpen] = useState(false)
  const [globalFilter, setGlobalFilter] = useState('')

  // Ctrl+F → 검색 바 토글
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Ctrl+Z/Y → Undo/Redo
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        editor.undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        editor.redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor])

  return (
    <div key={editorKey} className="flex flex-col h-full">
      <CsvToolbar
        encoding={encoding}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onAddRow={() => editor.executeCommand({
          type: 'addRow',
          index: editor.rows.length,
          row: editor.headers.map(() => '')
        })}
        onAddColumn={() => editor.executeCommand({
          type: 'addColumn',
          index: editor.headers.length,
          name: `Column ${editor.headers.length + 1}`
        })}
        onSearch={() => setSearchOpen(true)}
      />

      {searchOpen && (
        <CsvSearchBar
          value={globalFilter}
          onChange={setGlobalFilter}
          onClose={() => { setSearchOpen(false); setGlobalFilter('') }}
        />
      )}

      <div className="flex-1 min-h-0">
        <CsvTable
          headers={editor.headers}
          rows={editor.rows}
          modifiedCells={editor.modifiedCells}
          globalFilter={globalFilter}
          onEditCell={(row, col, value) => {
            const oldValue = editor.rows[row][col]
            if (oldValue !== value) {
              editor.executeCommand({ type: 'editCell', row, col, oldValue, newValue: value })
            }
          }}
          onDeleteRow={(index) => editor.executeCommand({
            type: 'deleteRow', index, row: editor.rows[index]
          })}
          onDeleteColumn={(index) => editor.executeCommand({
            type: 'deleteColumn',
            index,
            name: editor.headers[index],
            columnData: editor.rows.map((r) => r[index])
          })}
          onRenameColumn={(index, newName) => editor.executeCommand({
            type: 'renameColumn', index, oldName: editor.headers[index], newName
          })}
        />
      </div>
    </div>
  )
}
```

> `key={editorKey}` — 외부 변경 감지 시 `editorKey` 증가 → 컴포넌트 전체 리마운트 → `useCsvEditor` 재초기화.

### `src/renderer/src/features/csv-viewer/ui/CsvTable.tsx`

@tanstack/react-table + @tanstack/react-virtual 조합:

```typescript
import { useMemo, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CsvCell } from './CsvCell'
import { CsvColumnHeader } from './CsvColumnHeader'

interface CsvTableProps {
  headers: string[]
  rows: string[][]
  modifiedCells: Set<string>
  globalFilter: string
  onEditCell: (row: number, col: number, value: string) => void
  onDeleteRow: (index: number) => void
  onDeleteColumn: (index: number) => void
  onRenameColumn: (index: number, newName: string) => void
}

export function CsvTable({
  headers,
  rows,
  modifiedCells,
  globalFilter,
  onEditCell,
  onDeleteRow,
  onDeleteColumn,
  onRenameColumn
}: CsvTableProps): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo<ColumnDef<string[]>[]>(
    () =>
      headers.map((header, colIdx) => ({
        id: `col-${colIdx}`,
        accessorFn: (row: string[]) => row[colIdx] ?? '',
        header: () => (
          <CsvColumnHeader
            name={header}
            colIndex={colIdx}
            onRename={(newName) => onRenameColumn(colIdx, newName)}
            onDelete={() => onDeleteColumn(colIdx)}
          />
        ),
        cell: ({ row, getValue }) => (
          <CsvCell
            value={getValue() as string}
            isModified={modifiedCells.has(`${row.index}-${colIdx}`)}
            onCommit={(value) => onEditCell(row.index, colIdx, value)}
          />
        ),
        enableColumnFilter: true,
        enableSorting: true,
        enableResizing: true
      })),
    [headers, modifiedCells, onEditCell, onDeleteColumn, onRenameColumn]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true
  })

  const tableRows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 20
  })

  return (
    <div ref={parentRef} className="overflow-auto h-full">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              <th className="w-10 px-2 py-1 text-center text-xs text-muted-foreground">#</th>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="relative px-2 py-1 text-left font-medium border-r cursor-pointer select-none"
                  style={{ width: header.getSize() }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {/* resize handle */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
                  />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          className="relative"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = tableRows[vRow.index]
            return (
              <tr
                key={row.id}
                className="absolute w-full border-b hover:bg-muted/50"
                style={{ transform: `translateY(${vRow.start}px)`, height: '35px' }}
              >
                <td className="w-10 px-2 py-1 text-center text-xs text-muted-foreground">
                  {vRow.index + 1}
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-2 py-1 border-r"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

### `src/renderer/src/features/csv-viewer/ui/CsvCell.tsx`

```typescript
import { useState, useRef, useEffect } from 'react'
import { cn } from '@shared/lib/utils'

interface CsvCellProps {
  value: string
  isModified: boolean
  onCommit: (value: string) => void
}

export function CsvCell({ value, isModified, onCommit }: CsvCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className="w-full h-full bg-transparent outline-none border border-primary rounded px-1"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          onCommit(editValue)
          setIsEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setEditValue(value)
            setIsEditing(false)
          }
          if (e.key === 'Tab') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'truncate cursor-text min-h-[20px]',
        isModified && 'bg-yellow-100/50 dark:bg-yellow-900/20'
      )}
      onClick={() => setIsEditing(true)}
    >
      {value}
    </div>
  )
}
```

### `src/renderer/src/features/csv-viewer/ui/CsvColumnHeader.tsx`

```typescript
import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { Input } from '@shared/ui/input'

interface CsvColumnHeaderProps {
  name: string
  colIndex: number
  onRename: (newName: string) => void
  onDelete: () => void
}

export function CsvColumnHeader({
  name,
  colIndex,
  onRename,
  onDelete
}: CsvColumnHeaderProps): React.ReactElement {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)

  if (isRenaming) {
    return (
      <Input
        autoFocus
        className="h-6 text-xs"
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onBlur={() => {
          if (renameValue.trim() && renameValue !== name) onRename(renameValue.trim())
          setIsRenaming(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setRenameValue(name); setIsRenaming(false) }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-1">
          <span className="truncate">{name}</span>
          <ArrowUpDown className="size-3 shrink-0 text-muted-foreground" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setIsRenaming(true)}>
          <Pencil className="size-4 mr-2" />
          이름 변경
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          열 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### `src/renderer/src/features/csv-viewer/ui/CsvToolbar.tsx`

```typescript
import { Plus, Columns, Search, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { Badge } from '@shared/ui/badge'

interface CsvToolbarProps {
  encoding: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAddRow: () => void
  onAddColumn: () => void
  onSearch: () => void
}

export function CsvToolbar({
  encoding,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddRow,
  onAddColumn,
  onSearch
}: CsvToolbarProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-2 py-1 border-b shrink-0">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={onAddRow}>
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>행 추가</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={onAddColumn}>
              <Columns className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>열 추가</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>실행 취소 (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>다시 실행 (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {encoding}
        </Badge>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={onSearch}>
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>검색 (Ctrl+F)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
```

### `src/renderer/src/features/csv-viewer/ui/CsvSearchBar.tsx`

```typescript
import { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { Input } from '@shared/ui/input'
import { Button } from '@shared/ui/button'

interface CsvSearchBarProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

export function CsvSearchBar({ value, onChange, onClose }: CsvSearchBarProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/50 shrink-0">
      <Input
        ref={inputRef}
        className="h-7 text-sm flex-1"
        placeholder="검색..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      />
      <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}
```

### `src/renderer/src/features/csv-viewer/index.ts`

```typescript
export { CsvViewer } from './ui/CsvViewer'
```

---

## 15. 변경 파일 목록 요약

### 신규 파일 (26개)

| # | 파일 | 설명 |
|---|------|------|
| 1 | `src/main/db/schema/csv-file.ts` | Drizzle 스키마 |
| 2 | `src/main/repositories/csv-file.ts` | CRUD 리포지토리 |
| 3 | `src/main/services/csv-file.ts` | 비즈니스 로직 |
| 4 | `src/main/ipc/csv-file.ts` | IPC 핸들러 |
| 5 | `src/main/lib/leaf-reindex.ts` | 혼합 reindex 유틸 |
| 6 | `src/renderer/src/entities/csv-file/model/types.ts` | 타입 |
| 7 | `src/renderer/src/entities/csv-file/model/own-write-tracker.ts` | own-write 추적 |
| 8 | `src/renderer/src/entities/csv-file/model/use-csv-watcher.ts` | 외부 변경 구독 |
| 9 | `src/renderer/src/entities/csv-file/api/queries.ts` | React Query hooks |
| 10 | `src/renderer/src/entities/csv-file/index.ts` | barrel export |
| 11 | `src/renderer/src/features/folder/manage-folder/ui/CsvNodeRenderer.tsx` | 트리 노드 |
| 12 | `src/renderer/src/features/folder/manage-folder/ui/CsvContextMenu.tsx` | 컨텍스트 메뉴 |
| 13 | `src/renderer/src/features/csv-viewer/model/types.ts` | 에디터 타입 |
| 14 | `src/renderer/src/features/csv-viewer/model/csv-history.ts` | Undo/Redo |
| 15 | `src/renderer/src/features/csv-viewer/model/use-csv-editor.ts` | 핵심 에디터 훅 |
| 16 | `src/renderer/src/features/csv-viewer/model/use-csv-external-sync.ts` | 외부 동기화 |
| 17 | `src/renderer/src/features/csv-viewer/ui/CsvViewer.tsx` | 메인 뷰어 |
| 18 | `src/renderer/src/features/csv-viewer/ui/CsvTable.tsx` | 테이블 + 가상 스크롤 |
| 19 | `src/renderer/src/features/csv-viewer/ui/CsvCell.tsx` | 인라인 셀 편집 |
| 20 | `src/renderer/src/features/csv-viewer/ui/CsvColumnHeader.tsx` | 컬럼 헤더 |
| 21 | `src/renderer/src/features/csv-viewer/ui/CsvToolbar.tsx` | 툴바 |
| 22 | `src/renderer/src/features/csv-viewer/ui/CsvSearchBar.tsx` | 검색 바 |
| 23 | `src/renderer/src/features/csv-viewer/index.ts` | barrel export |
| 24 | `src/renderer/src/pages/csv/ui/CsvPage.tsx` | CSV 페이지 |
| 25 | `src/renderer/src/pages/csv/index.ts` | barrel export |
| 26 | DB migration 파일 | `db:generate` 자동 생성 |

### 수정 파일 (12개)

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `src/main/db/schema/index.ts` | csvFiles export 추가 |
| 2 | `src/main/index.ts` | registerCsvHandlers() 호출 |
| 3 | `src/main/services/workspace-watcher.ts` | .csv 이벤트 + csvReconciliation + 필터 수정 |
| 4 | `src/main/lib/fs-utils.ts` | readCsvFilesRecursive(Async) 추가 |
| 5 | `src/main/services/note.ts` | create(), move() — getLeafSiblings 사용 |
| 6 | `src/preload/index.ts` | csv bridge 추가 |
| 7 | `src/preload/index.d.ts` | CsvFileNode, CsvAPI, API 확장 |
| 8 | `src/renderer/src/app/layout/MainLayout.tsx` | useCsvWatcher() 등록 |
| 9 | `src/renderer/src/shared/constants/tab-url.ts` | TabType, TAB_ICON, ROUTES 확장 |
| 10 | `src/renderer/src/app/layout/model/pane-routes.tsx` | CsvPage 라우트 추가 |
| 11 | `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx` | csv 통합 |
| 12 | `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx` | CSV 추가 항목 |

### 추가 수정 파일 (2개)

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 13 | `src/renderer/src/features/folder/manage-folder/model/types.ts` | CsvTreeNode 추가 |
| 14 | `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` | CSV 병합 |
