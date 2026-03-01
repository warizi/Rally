# PDF Viewer Design Document

> **Summary**: Rally 앱에 PDF 파일 읽기 전용 뷰어를 추가한다. CSV 패턴을 복제하되 편집 기능을 제외.
>
> **Date**: 2026-03-01
> **Status**: Draft
> **Planning Doc**: [pdf-viewer.plan.md](../../01-plan/features/pdf-viewer.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- CSV 파일과 동일한 백엔드 패턴(DB → Repository → Service → IPC)으로 PDF 파일 관리
- `react-pdf` + `pdfjs-dist`로 렌더링, 페이지 네비게이션 + 줌 지원
- 탭 시스템 + 폴더 트리에 완전 통합
- Workspace Watcher로 외부 변경 실시간 감지

### 1.2 Design Principles

- CSV 패턴 **그대로 복제** — 구조적 일관성 유지
- 읽기 전용 — `writeContent` 없음
- 바이너리 전달 — main: `Buffer`, renderer: `ArrayBuffer` (Electron structured clone)

---

## 2. Architecture

### 2.1 Data Flow

```
[PDF Import]
  User → selectFile dialog → fs.copyFileSync → DB insert → 탭 열기

[PDF 렌더링]
  PdfPage → useReadPdfContent(IPC) → ArrayBuffer → react-pdf <Document> + <Page>

[외부 변경 감지]
  @parcel/watcher → applyEvents → pushPdfChanged(IPC) → usePdfWatcher → refetch + toast
```

### 2.2 Layer Map

```
┌─ Main Process ──────────────────────────────────────────────────┐
│  schema/pdf-file.ts → repositories/pdf-file.ts                  │
│    → services/pdf-file.ts → ipc/pdf-file.ts                    │
│  lib/leaf-reindex.ts (확장)                                      │
│  lib/fs-utils.ts (확장)                                          │
│  services/workspace-watcher.ts (확장)                            │
├─ Preload ───────────────────────────────────────────────────────┤
│  index.d.ts (PdfFileNode, PdfAPI)                               │
│  index.ts (pdf bridge)                                          │
├─ Renderer ──────────────────────────────────────────────────────┤
│  entities/pdf-file/ (queries, types, watcher, own-write-tracker)│
│  features/folder/manage-folder/ (types, tree builder, FolderTree)│
│  features/pdf/view-pdf/ (PdfHeader)                             │
│  widgets/pdf-viewer/ (PdfViewer, PdfToolbar)                    │
│  pages/pdf/ (PdfPage)                                           │
│  shared/constants/tab-url.ts (확장)                              │
│  app/layout/model/pane-routes.tsx (확장)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 DB Schema

**파일**: `src/main/db/schema/pdf-file.ts`

```typescript
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { folders } from './folder'

export const pdfFiles = sqliteTable(
  'pdf_files',
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

> CSV 대비 차이: `columnWidths` 컬럼 제거

### 3.2 Repository

**파일**: `src/main/repositories/pdf-file.ts`

CSV repository 패턴 그대로 복제. `columnWidths` 관련 로직 제거.

```typescript
import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '../db'
import { pdfFiles } from '../db/schema'

export type PdfFile = typeof pdfFiles.$inferSelect
export type PdfFileInsert = typeof pdfFiles.$inferInsert

export const pdfFileRepository = {
  findByWorkspaceId(workspaceId: string): PdfFile[] {
    return db.select().from(pdfFiles).where(eq(pdfFiles.workspaceId, workspaceId)).all()
  },

  findById(id: string): PdfFile | undefined {
    return db.select().from(pdfFiles).where(eq(pdfFiles.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): PdfFile | undefined {
    return db
      .select()
      .from(pdfFiles)
      .where(and(eq(pdfFiles.workspaceId, workspaceId), eq(pdfFiles.relativePath, relativePath)))
      .get()
  },

  create(data: PdfFileInsert): PdfFile {
    return db.insert(pdfFiles).values(data).returning().get()
  },

  createMany(items: PdfFileInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 99
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(pdfFiles).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<PdfFile, 'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'>
    >
  ): PdfFile | undefined {
    return db.update(pdfFiles).set(data).where(eq(pdfFiles.id, id)).returning().get()
  },

  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(pdfFiles).where(eq(pdfFiles.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: pdfFiles.id, relativePath: pdfFiles.relativePath })
      .from(pdfFiles)
      .where(eq(pdfFiles.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(pdfFiles).where(inArray(pdfFiles.id, orphanIds.slice(i, i + CHUNK))).run()
    }
  },

  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(pdfFiles)
      .where(and(eq(pdfFiles.workspaceId, workspaceId), like(pdfFiles.relativePath, `${prefix}/%`)))
      .run()
  },

  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE pdf_files
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
      `UPDATE pdf_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(pdfFiles).where(eq(pdfFiles.id, id)).run()
  }
}
```

### 3.3 Service

**파일**: `src/main/services/pdf-file.ts`

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { pdfFileRepository } from '../repositories/pdf-file'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readPdfFilesRecursive } from '../lib/fs-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'

export interface PdfFileNode {
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

function toPdfFileNode(row: {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}): PdfFileNode {
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

export const pdfFileService = {
  /** fs 스캔 + lazy upsert + orphan 삭제 */
  readByWorkspace(workspaceId: string): PdfFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    try {
      fs.accessSync(workspace.path)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspace.path}`)
    }

    const fsEntries = readPdfFilesRecursive(workspace.path, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbRows = pdfFileRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbRows.map((r) => r.relativePath))

    const fsPathSet = new Set(fsPaths)
    const newFsEntries = fsEntries.filter((e) => !dbPathSet.has(e.relativePath))
    const orphanedRows = dbRows.filter((r) => !fsPathSet.has(r.relativePath))

    // 이동 감지
    const orphanByBasename = new Map<string, (typeof orphanedRows)[0]>()
    for (const orphan of orphanedRows) {
      const basename = path.basename(orphan.relativePath)
      if (!orphanByBasename.has(basename)) orphanByBasename.set(basename, orphan)
    }

    const now = new Date()
    const toInsert: Parameters<typeof pdfFileRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      if (matchedOrphan) {
        pdfFileRepository.update(matchedOrphan.id, {
          relativePath: entry.relativePath,
          folderId: folder?.id ?? null,
          title: entry.name.replace(/\.pdf$/, ''),
          updatedAt: now
        })
        orphanByBasename.delete(entry.name)
      } else {
        toInsert.push({
          id: nanoid(),
          workspaceId,
          folderId: folder?.id ?? null,
          relativePath: entry.relativePath,
          title: entry.name.replace(/\.pdf$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }
    pdfFileRepository.createMany(toInsert)
    pdfFileRepository.deleteOrphans(workspaceId, fsPaths)

    return pdfFileRepository.findByWorkspaceId(workspaceId).map(toPdfFileNode)
  },

  /** DB-only 조회 (IPC 핸들러용) */
  readByWorkspaceFromDb(workspaceId: string): PdfFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return pdfFileRepository.findByWorkspaceId(workspaceId).map(toPdfFileNode)
  },

  /** 외부 PDF를 workspace로 복사 + DB 등록 */
  import(workspaceId: string, folderId: string | null, sourcePath: string): PdfFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    let folderRelPath: string | null = null
    if (folderId) {
      const folder = folderRepository.findById(folderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)
      folderRelPath = folder.relativePath
    }

    const parentAbs = folderRelPath ? path.join(workspace.path, folderRelPath) : workspace.path
    const sourceBaseName = path.basename(sourcePath)
    const finalFileName = resolveNameConflict(parentAbs, sourceBaseName)
    const title = finalFileName.replace(/\.pdf$/, '')

    const destAbs = path.join(parentAbs, finalFileName)
    const destRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )

    fs.copyFileSync(sourcePath, destAbs)

    const siblings = getLeafSiblings(workspaceId, folderId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = pdfFileRepository.create({
      id: nanoid(),
      workspaceId,
      folderId,
      relativePath: destRel,
      title,
      description: '',
      preview: '',
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })

    return toPdfFileNode(row)
  },

  /** 이름 변경 (disk + DB) */
  rename(workspaceId: string, pdfId: string, newName: string): PdfFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    if (newName.trim() === pdf.title) return toPdfFileNode(pdf)

    const folderRel = parentRelPath(pdf.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    const desiredFileName = newName.trim() + '.pdf'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.pdf$/, '')

    const oldAbs = path.join(workspace.path, pdf.relativePath)
    const newRel = normalizePath(folderRel ? `${folderRel}/${finalFileName}` : finalFileName)
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)

    const updated = pdfFileRepository.update(pdfId, {
      relativePath: newRel,
      title,
      updatedAt: new Date()
    })!

    return toPdfFileNode(updated)
  },

  /** 삭제 (disk + DB) */
  remove(workspaceId: string, pdfId: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    const absPath = path.join(workspace.path, pdf.relativePath)
    try {
      fs.unlinkSync(absPath)
    } catch {
      // 이미 외부에서 삭제된 경우 무시
    }
    pdfFileRepository.delete(pdfId)
  },

  /** 파일 읽기 → Buffer 반환 (renderer에서 ArrayBuffer로 수신) */
  readContent(workspaceId: string, pdfId: string): { data: Buffer } {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    const absPath = path.join(workspace.path, pdf.relativePath)
    let data: Buffer
    try {
      data = fs.readFileSync(absPath)
    } catch {
      throw new NotFoundError(`파일을 읽을 수 없습니다: ${absPath}`)
    }

    return { data }
  },

  /** 폴더 이동 (DnD) — 다른 폴더로 이동 + 혼합 siblings reindex */
  move(
    workspaceId: string,
    pdfId: string,
    targetFolderId: string | null,
    index: number
  ): PdfFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    let targetFolderRel: string | null = null
    if (targetFolderId) {
      const folder = folderRepository.findById(targetFolderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${targetFolderId}`)
      targetFolderRel = folder.relativePath
    }

    const pdfFileName = pdf.relativePath.split('/').at(-1)!
    const isSameFolder = pdf.folderId === targetFolderId

    let finalRel = pdf.relativePath
    let finalTitle = pdf.title

    if (!isSameFolder) {
      const parentAbs = targetFolderRel
        ? path.join(workspace.path, targetFolderRel)
        : workspace.path
      const finalFileName = resolveNameConflict(parentAbs, pdfFileName)
      finalTitle = finalFileName.replace(/\.pdf$/, '')
      finalRel = normalizePath(
        targetFolderRel ? `${targetFolderRel}/${finalFileName}` : finalFileName
      )

      const oldAbs = path.join(workspace.path, pdf.relativePath)
      const newAbs = path.join(workspace.path, finalRel)
      fs.renameSync(oldAbs, newAbs)

      pdfFileRepository.update(pdfId, {
        folderId: targetFolderId,
        relativePath: finalRel,
        title: finalTitle,
        updatedAt: new Date()
      })
    }

    // 혼합 siblings reindex (note + csv + pdf)
    const siblings = getLeafSiblings(workspaceId, targetFolderId)
    const withoutSelf = siblings.filter((s) => s.id !== pdfId)
    withoutSelf.splice(index, 0, { id: pdfId, kind: 'pdf', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      withoutSelf.map((s) => ({ id: s.id, kind: s.kind }))
    )

    const updated = pdfFileRepository.findById(pdfId)!
    return toPdfFileNode(updated)
  },

  /** 메타데이터 업데이트 (description만) */
  updateMeta(
    _workspaceId: string,
    pdfId: string,
    data: { description?: string }
  ): PdfFileNode {
    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    const updated = pdfFileRepository.update(pdfId, {
      ...data,
      updatedAt: new Date()
    })!

    return toPdfFileNode(updated)
  }
}
```

---

## 4. IPC Specification

### 4.1 IPC 핸들러

**파일**: `src/main/ipc/pdf-file.ts`

```typescript
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { pdfFileService } from '../services/pdf-file'

export function registerPdfFileHandlers(): void {
  ipcMain.handle(
    'pdf:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => pdfFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'pdf:import',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      sourcePath: string
    ): IpcResponse => handle(() => pdfFileService.import(workspaceId, folderId, sourcePath))
  )

  ipcMain.handle(
    'pdf:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string, newName: string): IpcResponse =>
      handle(() => pdfFileService.rename(workspaceId, pdfId, newName))
  )

  ipcMain.handle(
    'pdf:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string): IpcResponse =>
      handle(() => pdfFileService.remove(workspaceId, pdfId))
  )

  ipcMain.handle(
    'pdf:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string): IpcResponse =>
      handle(() => pdfFileService.readContent(workspaceId, pdfId))
  )

  ipcMain.handle(
    'pdf:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      pdfId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => pdfFileService.move(workspaceId, pdfId, folderId, index))
  )

  ipcMain.handle(
    'pdf:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      pdfId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => pdfFileService.updateMeta(workspaceId, pdfId, data))
  )

  ipcMain.handle('pdf:selectFile', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
```

### 4.2 채널 목록

| 채널 | 파라미터 | 반환 |
|------|---------|------|
| `pdf:readByWorkspace` | `workspaceId` | `IpcResponse<PdfFileNode[]>` |
| `pdf:import` | `workspaceId, folderId, sourcePath` | `IpcResponse<PdfFileNode>` |
| `pdf:rename` | `workspaceId, pdfId, newName` | `IpcResponse<PdfFileNode>` |
| `pdf:remove` | `workspaceId, pdfId` | `IpcResponse<void>` |
| `pdf:readContent` | `workspaceId, pdfId` | `IpcResponse<{ data: Buffer }>` |
| `pdf:move` | `workspaceId, pdfId, folderId, index` | `IpcResponse<PdfFileNode>` |
| `pdf:updateMeta` | `workspaceId, pdfId, data` | `IpcResponse<PdfFileNode>` |
| `pdf:selectFile` | (없음) | `string \| null` |

---

## 5. 기존 파일 수정 상세

### 5.1 Leaf Reindex 확장

**파일**: `src/main/lib/leaf-reindex.ts`

```diff
+ import { pdfFileRepository } from '../repositories/pdf-file'

  export interface LeafSibling {
    id: string
-   kind: 'note' | 'csv'
+   kind: 'note' | 'csv' | 'pdf'
    order: number
  }

  export function getLeafSiblings(workspaceId: string, folderId: string | null): LeafSibling[] {
    const notes = noteRepository.findByWorkspaceId(workspaceId)
      .filter((n) => n.folderId === folderId)
      .map((n) => ({ id: n.id, kind: 'note' as const, order: n.order }))
    const csvs = csvFileRepository.findByWorkspaceId(workspaceId)
      .filter((c) => c.folderId === folderId)
      .map((c) => ({ id: c.id, kind: 'csv' as const, order: c.order }))
+   const pdfs = pdfFileRepository.findByWorkspaceId(workspaceId)
+     .filter((p) => p.folderId === folderId)
+     .map((p) => ({ id: p.id, kind: 'pdf' as const, order: p.order }))
-   return [...notes, ...csvs].sort((a, b) => a.order - b.order)
+   return [...notes, ...csvs, ...pdfs].sort((a, b) => a.order - b.order)
  }

  export function reindexLeafSiblings(
    workspaceId: string,
-   orderedItems: Array<{ id: string; kind: 'note' | 'csv' }>
+   orderedItems: Array<{ id: string; kind: 'note' | 'csv' | 'pdf' }>
  ): void {
    const now = Date.now()
    const noteStmt = db.$client.prepare(...)
    const csvStmt = db.$client.prepare(...)
+   const pdfStmt = db.$client.prepare(
+     `UPDATE pdf_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
+   )
    db.$client.transaction(() => {
      orderedItems.forEach((item, i) => {
        if (item.kind === 'note') noteStmt.run(i, now, workspaceId, item.id)
-       else csvStmt.run(i, now, workspaceId, item.id)
+       else if (item.kind === 'csv') csvStmt.run(i, now, workspaceId, item.id)
+       else pdfStmt.run(i, now, workspaceId, item.id)
      })
    })()
  }
```

### 5.2 fs-utils 확장

**파일**: `src/main/lib/fs-utils.ts`

```typescript
// 기존 MdFileEntry, CsvFileEntry 패턴과 동일

export interface PdfFileEntry {
  name: string
  relativePath: string
}

export function readPdfFilesRecursive(absBase: string, parentRel: string): PdfFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: PdfFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readPdfFilesRecursive(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

export async function readPdfFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<PdfFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: PdfFileEntry[] = []
  const subDirPromises: Promise<PdfFileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      subDirPromises.push(readPdfFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  const subResults = await Promise.all(subDirPromises)
  return result.concat(...subResults)
}
```

### 5.3 Workspace Watcher 확장

**파일**: `src/main/services/workspace-watcher.ts`

#### 5.3.1 import 추가

```diff
  import { csvFileRepository } from '../repositories/csv-file'
+ import { pdfFileRepository } from '../repositories/pdf-file'
- import { readMdFilesRecursiveAsync, readCsvFilesRecursiveAsync } from '../lib/fs-utils'
+ import { readMdFilesRecursiveAsync, readCsvFilesRecursiveAsync, readPdfFilesRecursiveAsync } from '../lib/fs-utils'
```

#### 5.3.2 `start()` — pdfReconciliation + pushPdfChanged 추가

```diff
    try {
      await this.csvReconciliation(workspaceId, workspacePath)
    } catch {
      /* ignore */
    }
+   try {
+     await this.pdfReconciliation(workspaceId, workspacePath)
+   } catch {
+     /* ignore — watcher continues without initial pdf sync */
+   }

    this.pushFolderChanged(workspaceId, [])
    this.pushNoteChanged(workspaceId, [])
    this.pushCsvChanged(workspaceId, [])
+   this.pushPdfChanged(workspaceId, [])
```

#### 5.3.3 `applyEvents()` — return type 확장

```diff
  private async applyEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): Promise<{
    folderPaths: string[]
    orphanNotePaths: string[]
    orphanCsvPaths: string[]
+   orphanPdfPaths: string[]
  }> {
    const changedFolderPaths: string[] = []
    const orphanNotePaths: string[] = []
    const orphanCsvPaths: string[] = []
+   const orphanPdfPaths: string[] = []
```

#### 5.3.4 Step 1 (폴더 rename) — bulkUpdatePathPrefix 추가

```diff
          folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          csvFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
+         pdfFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
```

> oldPath rename 분기에서도 동일하게 추가:

```diff
        folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        csvFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
+       pdfFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
```

#### 5.3.5 Step 2 — `.pdf` 필터 추가

```diff
      if (absPath.endsWith('.md')) continue
      if (absPath.endsWith('.csv')) continue
+     if (absPath.endsWith('.pdf')) continue
```

#### 5.3.6 Step 2 (폴더 delete) — orphanPdfPaths 수집 + bulkDeleteByPrefix

```diff
          const childCsvs = csvFileRepository
            .findByWorkspaceId(workspaceId)
            .filter((c) => c.relativePath.startsWith(rel + '/'))
+         const childPdfs = pdfFileRepository
+           .findByWorkspaceId(workspaceId)
+           .filter((p) => p.relativePath.startsWith(rel + '/'))
          orphanNotePaths.push(...childNotes.map((n) => n.relativePath))
          orphanCsvPaths.push(...childCsvs.map((c) => c.relativePath))
+         orphanPdfPaths.push(...childPdfs.map((p) => p.relativePath))

          noteRepository.bulkDeleteByPrefix(workspaceId, rel)
          csvFileRepository.bulkDeleteByPrefix(workspaceId, rel)
+         pdfFileRepository.bulkDeleteByPrefix(workspaceId, rel)
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
```

#### 5.3.7 Steps 9~11 (신규) — `.pdf` 파일 rename/move/create/delete

CSV Steps 6~8을 복제하여 `.pdf` 전용 블록 추가. Step 8 다음에 삽입:

```typescript
    // ─── Step 9: .pdf 파일 rename/move 감지 ──────────────────────
    const pdfDeletes = events.filter(
      (e) =>
        e.type === 'delete' && e.path.endsWith('.pdf') && !path.basename(e.path).startsWith('.')
    )
    const pdfCreates = events.filter(
      (e) =>
        e.type === 'create' && e.path.endsWith('.pdf') && !path.basename(e.path).startsWith('.')
    )
    const pairedPdfDeletePaths = new Set<string>()
    const pairedPdfCreatePaths = new Set<string>()
    for (const createEvent of pdfCreates) {
      const createDir = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      const matchingDelete =
        pdfDeletes.find(
          (d) => !pairedPdfDeletePaths.has(d.path) && path.dirname(d.path) === createDir
        ) ??
        pdfDeletes.find(
          (d) => !pairedPdfDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existing = pdfFileRepository.findByRelativePath(workspaceId, oldRel)
        if (existing) {
          const newParentRel = newRel.includes('/')
            ? newRel.split('/').slice(0, -1).join('/')
            : null
          const newFolder = newParentRel
            ? folderRepository.findByRelativePath(workspaceId, newParentRel)
            : null
          pdfFileRepository.update(existing.id, {
            relativePath: newRel,
            folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
            title: path.basename(createEvent.path, '.pdf'),
            updatedAt: new Date()
          })
          pairedPdfDeletePaths.add(matchingDelete.path)
          pairedPdfCreatePaths.add(createEvent.path)
        }
      }
    }

    // ─── Step 10: standalone PDF create → DB에 pdf 추가 ──────────
    for (const createEvent of pdfCreates) {
      if (pairedPdfCreatePaths.has(createEvent.path)) continue
      const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = pdfFileRepository.findByRelativePath(workspaceId, rel)
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
        pdfFileRepository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          folderId: folder?.id ?? null,
          title: path.basename(createEvent.path, '.pdf'),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }

    // ─── Step 11: standalone PDF delete → DB에서 pdf 삭제 ────────
    for (const deleteEvent of pdfDeletes) {
      if (pairedPdfDeletePaths.has(deleteEvent.path)) continue
      const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
      const existing = pdfFileRepository.findByRelativePath(workspaceId, rel)
      if (existing) {
        pdfFileRepository.delete(existing.id)
      }
    }
```

#### 5.3.8 `applyEvents()` return 변경

```diff
-   return { folderPaths: changedFolderPaths, orphanNotePaths, orphanCsvPaths }
+   return { folderPaths: changedFolderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths }
```

#### 5.3.9 `handleEvents()` — PDF 변경 수집 + pushPdfChanged

```diff
        const { folderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths } = await this.applyEvents(
          workspaceId,
          workspacePath,
          eventsToProcess
        )
        // ... (기존 folder, note, csv changed 처리) ...

+       // 변경된 .pdf 파일 경로 수집 + 폴더 삭제로 함께 삭제된 PDF 경로 병합
+       const changedPdfRelPaths = [
+         ...eventsToProcess
+           .filter((e) => e.path.endsWith('.pdf') && !path.basename(e.path).startsWith('.'))
+           .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
+         ...orphanPdfPaths
+       ]
+       this.pushPdfChanged(workspaceId, changedPdfRelPaths)
```

#### 5.3.10 `pdfReconciliation()` — csvReconciliation 복제

```typescript
  private async pdfReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = await readPdfFilesRecursiveAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbPdfs = pdfFileRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbPdfs.map((p) => p.relativePath))

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
          title: e.name.replace(/\.pdf$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })

    pdfFileRepository.createMany(toInsert)
    pdfFileRepository.deleteOrphans(workspaceId, fsPaths)
  }
```

#### 5.3.11 `pushPdfChanged()` — pushCsvChanged 복제

```typescript
  private pushPdfChanged(workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('pdf:changed', workspaceId, changedRelPaths)
    })
  }
```

### 5.4 Preload Bridge

**파일**: `src/preload/index.d.ts` — 타입 추가

```typescript
interface PdfFileNode {
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

interface PdfAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<PdfFileNode[]>>
  import: (workspaceId: string, folderId: string | null, sourcePath: string) => Promise<IpcResponse<PdfFileNode>>
  rename: (workspaceId: string, pdfId: string, newName: string) => Promise<IpcResponse<PdfFileNode>>
  remove: (workspaceId: string, pdfId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, pdfId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (workspaceId: string, pdfId: string, folderId: string | null, index: number) => Promise<IpcResponse<PdfFileNode>>
  updateMeta: (workspaceId: string, pdfId: string, data: { description?: string }) => Promise<IpcResponse<PdfFileNode>>
  selectFile: () => Promise<string | null>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface API {
  note: NoteAPI
  csv: CsvAPI
+ pdf: PdfAPI
  folder: FolderAPI
  // ...
}
```

**파일**: `src/preload/index.ts` — bridge 구현

```typescript
pdf: {
  readByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('pdf:readByWorkspace', workspaceId),
  import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
    ipcRenderer.invoke('pdf:import', workspaceId, folderId, sourcePath),
  rename: (workspaceId: string, pdfId: string, newName: string) =>
    ipcRenderer.invoke('pdf:rename', workspaceId, pdfId, newName),
  remove: (workspaceId: string, pdfId: string) =>
    ipcRenderer.invoke('pdf:remove', workspaceId, pdfId),
  readContent: (workspaceId: string, pdfId: string) =>
    ipcRenderer.invoke('pdf:readContent', workspaceId, pdfId),
  move: (workspaceId: string, pdfId: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke('pdf:move', workspaceId, pdfId, folderId, index),
  updateMeta: (workspaceId: string, pdfId: string, data: { description?: string }) =>
    ipcRenderer.invoke('pdf:updateMeta', workspaceId, pdfId, data),
  selectFile: () => ipcRenderer.invoke('pdf:selectFile'),
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      workspaceId: string,
      changedRelPaths: string[]
    ): void => callback(workspaceId, changedRelPaths)
    ipcRenderer.on('pdf:changed', handler)
    return () => ipcRenderer.removeListener('pdf:changed', handler)
  }
},
```

---

## 5A. Glue File Registrations

> 사소하지만 빠뜨리면 런타임에서 실패하는 등록 파일 3개.

### 5A.1 `src/main/db/schema/index.ts` — pdfFiles export

```diff
  import { csvFiles } from './csv-file'
+ import { pdfFiles } from './pdf-file'
  import { todos } from './todo'
  import { appSettings } from './app-settings'

- export { workspaces, tabSessions, tabSnapshots, folders, notes, csvFiles, todos, appSettings }
+ export { workspaces, tabSessions, tabSnapshots, folders, notes, csvFiles, pdfFiles, todos, appSettings }
```

### 5A.2 `src/main/index.ts` — registerPdfFileHandlers 등록

```diff
  import { registerCsvFileHandlers } from './ipc/csv-file'
+ import { registerPdfFileHandlers } from './ipc/pdf-file'
  import { registerAppSettingsHandlers } from './ipc/app-settings'

  // ... app.whenReady().then(() => { ... })
  registerCsvFileHandlers()
+ registerPdfFileHandlers()
  registerAppSettingsHandlers()
```

### 5A.3 `src/renderer/src/app/layout/MainLayout.tsx` — usePdfWatcher 등록

```diff
  import { useCsvWatcher } from '@entities/csv-file'
+ import { usePdfWatcher } from '@entities/pdf-file'

  function MainLayout(): React.JSX.Element {
    useSessionPersistence()
    useFolderWatcher()
    useNoteWatcher()
    useCsvWatcher()
+   usePdfWatcher()
```

---

## 6. Renderer 설계

### 6.1 Entity Layer

**디렉토리**: `src/renderer/src/entities/pdf-file/`

#### types.ts
```typescript
export interface PdfFileNode {
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

#### own-write-tracker.ts
```typescript
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

export function markAsOwnWrite(pdfId: string): void {
  const prev = pendingWrites.get(pdfId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(pdfId), 2000)
  pendingWrites.set(pdfId, timer)
}

export function isOwnWrite(pdfId: string): boolean {
  return pendingWrites.has(pdfId)
}
```

#### api/queries.ts

CSV queries 패턴 복제. 주요 차이: `import` (sourcePath), `readContent` (ArrayBuffer), `writeContent` 없음, `updateMeta` (columnWidths 없음).

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
import type { PdfFileNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { markAsOwnWrite } from '../model/own-write-tracker'

const PDF_KEY = 'pdf'

export function usePdfFilesByWorkspace(workspaceId: string): UseQueryResult<PdfFileNode[]> {
  return useQuery({
    queryKey: [PDF_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<PdfFileNode[]> => {
      const res: IpcResponse<PdfFileNode[]> = await window.api.pdf.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useImportPdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; sourcePath: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, sourcePath }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.import(
        workspaceId,
        folderId,
        sourcePath
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenamePdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, pdfId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(pdfId)
    },
    mutationFn: async ({ workspaceId, pdfId, newName }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.rename(
        workspaceId,
        pdfId,
        newName
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemovePdfFile(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; pdfId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, pdfId }) => {
      const res: IpcResponse<void> = await window.api.pdf.remove(workspaceId, pdfId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadPdfContent(
  workspaceId: string,
  pdfId: string
): UseQueryResult<{ data: ArrayBuffer }> {
  return useQuery({
    queryKey: [PDF_KEY, 'content', pdfId],
    queryFn: async (): Promise<{ data: ArrayBuffer }> => {
      const res: IpcResponse<{ data: ArrayBuffer }> = await window.api.pdf.readContent(
        workspaceId,
        pdfId
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? { data: new ArrayBuffer(0) }
    },
    enabled: !!workspaceId && !!pdfId,
    staleTime: Infinity
  })
}

export function useMovePdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, pdfId, folderId, index }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.move(
        workspaceId,
        pdfId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdatePdfMeta(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, pdfId, data }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.updateMeta(
        workspaceId,
        pdfId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}
```

#### model/use-pdf-watcher.ts

CSV watcher 복제. `FileType` 아이콘 사용 (Sheet 대신).

```typescript
import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileType } from 'lucide-react'
import { toast } from 'sonner'
import type { PdfFileNode } from './types'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const PDF_EXTERNAL_CHANGED_EVENT = 'pdf:external-changed'

/** MainLayout에서 호출 — pdf:changed push 이벤트 구독 + React Query invalidation */
export function usePdfWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.pdf.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      // PDF 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['pdf', 'workspace', workspaceId] })

      // 변경된 파일 중 외부 변경만 처리
      const pdfs = queryClient.getQueryData<PdfFileNode[]>(['pdf', 'workspace', workspaceId])
      if (pdfs && changedRelPaths.length > 0) {
        const externalPdfs = pdfs.filter(
          (p) =>
            changedRelPaths.includes(p.relativePath) &&
            !isOwnWrite(p.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )
        if (readyRef.current && externalPdfs.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalPdfs.map((p) =>
                createElement(
                  'li',
                  { key: p.id, className: 'flex items-center gap-1.5' },
                  createElement(FileType, { className: 'size-3.5 shrink-0' }),
                  p.title
                )
              )
            )
          })
        }
        externalPdfs.forEach((p) => {
          queryClient.refetchQueries({ queryKey: ['pdf', 'content', p.id] }).then(() => {
            window.dispatchEvent(
              new CustomEvent(PDF_EXTERNAL_CHANGED_EVENT, { detail: { pdfId: p.id } })
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

#### index.ts
```typescript
export { usePdfFilesByWorkspace, useImportPdfFile, useRenamePdfFile, useRemovePdfFile,
         useReadPdfContent, useMovePdfFile, useUpdatePdfMeta } from './api/queries'
export type { PdfFileNode } from './model/types'
export { usePdfWatcher, PDF_EXTERNAL_CHANGED_EVENT } from './model/use-pdf-watcher'
```

### 6.2 Tab System + Routing

**`src/renderer/src/shared/constants/tab-url.ts`**:
```diff
- import { Calendar, Check, FileText, FolderOpen, LayoutDashboard, Sheet } from 'lucide-react'
+ import { Calendar, Check, FileText, FileType, FolderOpen, LayoutDashboard, Sheet } from 'lucide-react'

- export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'calendar'
+ export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'pdf' | 'calendar'

  export const TAB_ICON: Record<TabIcon, React.ElementType> = {
    // ...기존 항목...
    csv: Sheet,
+   pdf: FileType,
    calendar: Calendar
  }

  export const ROUTES = {
    // ...기존 항목...
    CSV_DETAIL: '/folder/csv/:csvId',
+   PDF_DETAIL: '/folder/pdf/:pdfId',
    CALENDAR: '/calendar'
  } as const
```

**`src/renderer/src/app/layout/model/pane-routes.tsx`**:
```typescript
const PdfPage = lazy(() => import('@pages/pdf'))
// PANE_ROUTES에 { pattern: ROUTES.PDF_DETAIL, component: PdfPage } 추가
```

### 6.3 Folder Tree Integration

#### types.ts 수정
```diff
+ export interface PdfTreeNode {
+   kind: 'pdf'
+   id: string
+   name: string
+   relativePath: string
+   description: string
+   preview: string
+   folderId: string | null
+   order: number
+ }

- export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode
+ export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode | PdfTreeNode
```

#### use-workspace-tree.ts 수정

**파일**: `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts`

##### import 추가

```diff
  import { useCsvFilesByWorkspace } from '@entities/csv-file'
+ import { usePdfFilesByWorkspace } from '@entities/pdf-file'
+ import type { PdfFileNode } from '@entities/pdf-file'
+ import type { PdfTreeNode } from './types'
```

##### buildWorkspaceTree 시그니처 + 내부

```diff
  export function buildWorkspaceTree(
    folders: FolderNode[],
    notes: NoteNode[],
-   csvFiles: CsvFileNode[]
+   csvFiles: CsvFileNode[],
+   pdfFiles: PdfFileNode[]
  ): WorkspaceTreeNode[] {

+   function convertPdf(pdf: PdfFileNode): PdfTreeNode {
+     return {
+       kind: 'pdf',
+       id: pdf.id,
+       name: pdf.title,
+       relativePath: pdf.relativePath,
+       description: pdf.description,
+       preview: pdf.preview,
+       folderId: pdf.folderId,
+       order: pdf.order
+     }
+   }

    function getLeafChildren(folderId: string | null): WorkspaceTreeNode[] {
      const childNotes = notes.filter((n) => n.folderId === folderId).map(convertNote)
      const childCsvs = csvFiles.filter((c) => c.folderId === folderId).map(convertCsv)
+     const childPdfs = pdfFiles.filter((p) => p.folderId === folderId).map(convertPdf)
-     return [...childNotes, ...childCsvs].sort((a, b) => a.order - b.order)
+     return [...childNotes, ...childCsvs, ...childPdfs].sort((a, b) => a.order - b.order)
    }
  }
```

##### useWorkspaceTree 훅 변경

```diff
  export function useWorkspaceTree(workspaceId: string) {
    const { data: folders = [], isLoading: isFoldersLoading } = useFolderTree(workspaceId)
    const { data: notes = [], isLoading: isNotesLoading } = useNotesByWorkspace(workspaceId)
    const { data: csvFiles = [], isLoading: isCsvsLoading } = useCsvFilesByWorkspace(workspaceId)
+   const { data: pdfFiles = [], isLoading: isPdfsLoading } = usePdfFilesByWorkspace(workspaceId)

-   const tree = buildWorkspaceTree(folders, notes, csvFiles)
+   const tree = buildWorkspaceTree(folders, notes, csvFiles, pdfFiles)

-   return { tree, isLoading: isFoldersLoading || isNotesLoading || isCsvsLoading }
+   return { tree, isLoading: isFoldersLoading || isNotesLoading || isCsvsLoading || isPdfsLoading }
  }
```

#### FolderTree.tsx 수정

**파일**: `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`

##### import 추가

```diff
  import { useCreateCsvFile, useMoveCsvFile, useRemoveCsvFile } from '@entities/csv-file'
+ import { useImportPdfFile, useMovePdfFile, useRemovePdfFile } from '@entities/pdf-file'
  import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode, CsvTreeNode } from '../model/types'
+ import type { PdfTreeNode } from '../model/types'
  import { CsvContextMenu } from './CsvContextMenu'
  import { CsvNodeRenderer } from './CsvNodeRenderer'
+ import { PdfContextMenu } from './PdfContextMenu'
+ import { PdfNodeRenderer } from './PdfNodeRenderer'
```

##### 뮤테이션 + 상태 추가

```diff
  // CSV mutations
  const { mutate: createCsvFile } = useCreateCsvFile()
  const { mutate: moveCsvFile } = useMoveCsvFile()
  const { mutate: removeCsvFile, isPending: isRemovingCsv } = useRemoveCsvFile()

+ // PDF mutations
+ const { mutate: importPdfFile } = useImportPdfFile()
+ const { mutate: movePdfFile } = useMovePdfFile()
+ const { mutate: removePdfFile, isPending: isRemovingPdf } = useRemovePdfFile()

  // CSV dialog states
  const [csvDeleteTarget, setCsvDeleteTarget] = useState<{ id: string; name: string } | null>(null)

+ // PDF dialog states
+ const [pdfDeleteTarget, setPdfDeleteTarget] = useState<{ id: string; name: string } | null>(null)
```

##### PDF 가져오기 핸들러 추가

```typescript
/** PDF 가져오기 → selectFile 다이얼로그 → import → 오른쪽 탭 열기 */
const handleImportPdf = useCallback(
  async (folderId: string | null) => {
    const sourcePath = await window.api.pdf.selectFile()
    if (!sourcePath) return
    importPdfFile(
      { workspaceId, folderId, sourcePath },
      {
        onSuccess: (pdf) => {
          if (!pdf) return
          openRightTab(
            {
              type: 'pdf',
              title: pdf.title,
              pathname: `/folder/pdf/${pdf.id}`
            },
            sourcePaneId
          )
        }
      }
    )
  },
  [workspaceId, sourcePaneId, importPdfFile, openRightTab]
)
```

##### NodeRenderer에 PDF 분기 추가 (CSV 분기 다음)

```diff
      if (props.node.data.kind === 'csv') {
        return (
          <CsvContextMenu ...>
            <div><CsvNodeRenderer ... /></div>
          </CsvContextMenu>
        )
      }

+     if (props.node.data.kind === 'pdf') {
+       return (
+         <PdfContextMenu
+           onDelete={() =>
+             setPdfDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
+           }
+         >
+           <div>
+             <PdfNodeRenderer
+               {...(props as unknown as NodeRendererProps<PdfTreeNode>)}
+               onOpen={() =>
+                 openRightTab(
+                   {
+                     type: 'pdf',
+                     title: props.node.data.name,
+                     pathname: `/folder/pdf/${props.node.data.id}`
+                   },
+                   sourcePaneId
+                 )
+               }
+             />
+           </div>
+         </PdfContextMenu>
+       )
+     }

      // kind === 'folder'
```

##### 가드 수정

```diff
  disableDrop={({ parentNode }) =>
-   parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv'
+   parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv' || parentNode?.data.kind === 'pdf'
  }
  disableEdit={(n) =>
-   n.kind === 'note' || n.kind === 'csv'
+   n.kind === 'note' || n.kind === 'csv' || n.kind === 'pdf'
  }
```

##### onMove에 PDF 분기 추가

```diff
  onMove={({ dragIds, dragNodes, parentId, index }) => {
    const kind = dragNodes[0]?.data.kind
    if (kind === 'note') {
      moveNote({ workspaceId, noteId: dragIds[0], folderId: parentId ?? null, index })
    } else if (kind === 'csv') {
      moveCsvFile({ workspaceId, csvId: dragIds[0], folderId: parentId ?? null, index })
+   } else if (kind === 'pdf') {
+     movePdfFile({ workspaceId, pdfId: dragIds[0], folderId: parentId ?? null, index })
    } else {
      move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
    }
  }}
```

##### onDelete에 PDF 분기 추가

```diff
  onDelete={({ ids, nodes }) => {
    const firstNode = nodes[0]
    if (firstNode.data.kind === 'note') {
      setNoteDeleteTarget({ id: ids[0], name: firstNode.data.name })
    } else if (firstNode.data.kind === 'csv') {
      setCsvDeleteTarget({ id: ids[0], name: firstNode.data.name })
+   } else if (firstNode.data.kind === 'pdf') {
+     setPdfDeleteTarget({ id: ids[0], name: firstNode.data.name })
    } else {
      setDeleteTarget({ id: ids[0], name: firstNode.data.name })
    }
  }}
```

##### FolderContextMenu에 onImportPdf prop 전달

```diff
  <FolderContextMenu
    onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
    onCreateNote={() => handleCreateNote(props.node.id)}
    onCreateCsv={() => handleCreateCsv(props.node.id)}
+   onImportPdf={() => handleImportPdf(props.node.id)}
    onRename={() => ...}
    onEditColor={() => ...}
    onDelete={() => ...}
  >
```

##### PDF 삭제 다이얼로그 (CSV 삭제 다이얼로그 다음에 추가)

```tsx
{/* PDF 삭제 다이얼로그 */}
<DeleteFolderDialog
  open={pdfDeleteTarget !== null}
  onOpenChange={(open) => {
    if (!open) setPdfDeleteTarget(null)
  }}
  folderName={pdfDeleteTarget?.name ?? ''}
  isPending={isRemovingPdf}
  onConfirm={() => {
    if (pdfDeleteTarget) {
      removePdfFile(
        { workspaceId, pdfId: pdfDeleteTarget.id },
        { onSuccess: () => setPdfDeleteTarget(null) }
      )
    }
  }}
/>
```

#### PdfNodeRenderer.tsx (신규)

**파일**: `src/renderer/src/features/folder/manage-folder/ui/PdfNodeRenderer.tsx`

CsvNodeRenderer 패턴 복제. `FileType` 아이콘 + 빨간 계열 색상.

```tsx
import type { NodeRendererProps } from 'react-arborist'
import { FileType } from 'lucide-react'
import type { PdfTreeNode } from '../model/types'

interface Props extends NodeRendererProps<PdfTreeNode> {
  onOpen: () => void
}

export function PdfNodeRenderer({ node, style, dragHandle, onOpen }: Props): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 py-0.5 px-1 rounded-sm cursor-pointer hover:bg-accent text-sm group"
      onClick={onOpen}
    >
      <FileType className="size-4 shrink-0 text-red-500" />
      <span className="truncate">{node.data.name}</span>
    </div>
  )
}
```

#### PdfContextMenu.tsx (신규)

**파일**: `src/renderer/src/features/folder/manage-folder/ui/PdfContextMenu.tsx`

NoteContextMenu/CsvContextMenu 패턴 복제. 삭제만 제공.

```tsx
import { Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@shared/ui/context-menu'

interface Props {
  children: React.ReactNode
  onDelete: () => void
}

export function PdfContextMenu({ children, onDelete }: Props): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

#### FolderContextMenu.tsx 수정

```diff
- import { FileText, FolderPlus, Palette, Pencil, Sheet, Trash2 } from 'lucide-react'
+ import { FileText, FileType, FolderPlus, Palette, Pencil, Sheet, Trash2 } from 'lucide-react'

  interface Props {
    children: React.ReactNode
    onCreateChild: () => void
    onCreateNote: () => void
    onCreateCsv: () => void
+   onImportPdf: () => void
    onRename: () => void
    onEditColor: () => void
    onDelete: () => void
  }

  // ContextMenuContent 내부, 테이블 추가하기 다음:
+       <ContextMenuItem onClick={onImportPdf}>
+         <FileType className="size-4 mr-2" />
+         PDF 가져오기
+       </ContextMenuItem>
```

### 6.4 PDF Viewer Widget

**디렉토리**: `src/renderer/src/widgets/pdf-viewer/`

#### model/use-pdf-viewer.ts
```typescript
interface PdfViewerState {
  currentPage: number
  numPages: number
  scale: number
}

export function usePdfViewer() {
  const [state, setState] = useState<PdfViewerState>({
    currentPage: 1,
    numPages: 0,
    scale: 1.0
  })

  const goToPage = (page: number) => { ... }
  const nextPage = () => { ... }
  const prevPage = () => { ... }
  const zoomIn = () => { ... }   // scale + 0.25, max 4.0
  const zoomOut = () => { ... }  // scale - 0.25, min 0.25
  const resetZoom = () => { ... } // scale = 1.0
  const onDocumentLoadSuccess = ({ numPages }) => { ... }

  return { ...state, goToPage, nextPage, prevPage, zoomIn, zoomOut, resetZoom, onDocumentLoadSuccess }
}
```

#### ui/PdfViewer.tsx
```tsx
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { usePdfViewer } from '../model/use-pdf-viewer'
import { PdfToolbar } from './PdfToolbar'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  data: ArrayBuffer
}

export function PdfViewer({ data }: PdfViewerProps): JSX.Element {
  const viewer = usePdfViewer()

  return (
    <div className="flex flex-col h-full">
      <PdfToolbar {...viewer} />
      <div className="flex-1 overflow-auto flex justify-center bg-muted/30 p-4">
        <Document
          file={{ data }}
          onLoadSuccess={viewer.onDocumentLoadSuccess}
        >
          <Page pageNumber={viewer.currentPage} scale={viewer.scale} />
        </Document>
      </div>
    </div>
  )
}
```

#### ui/PdfToolbar.tsx

```tsx
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { useState } from 'react'

interface PdfToolbarProps {
  currentPage: number
  numPages: number
  scale: number
  goToPage: (page: number) => void
  prevPage: () => void
  nextPage: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export function PdfToolbar({
  currentPage,
  numPages,
  scale,
  goToPage,
  prevPage,
  nextPage,
  zoomIn,
  zoomOut,
  resetZoom
}: PdfToolbarProps) {
  const [pageInput, setPageInput] = useState('')

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(pageInput, 10)
    if (page >= 1 && page <= numPages) {
      goToPage(page)
    }
    setPageInput('')
  }

  return (
    <div className="flex items-center justify-between border-b px-3 py-1.5 bg-background">
      {/* 페이지 네비게이션 */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={prevPage} disabled={currentPage <= 1}>
          <ChevronLeft className="size-4" />
        </Button>
        <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
          <Input
            className="w-12 h-7 text-center text-sm"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            placeholder={String(currentPage)}
          />
          <span className="text-sm text-muted-foreground">/ {numPages}</span>
        </form>
        <Button variant="ghost" size="icon-sm" onClick={nextPage} disabled={currentPage >= numPages}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* 줌 컨트롤 */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={zoomOut} disabled={scale <= 0.25}>
          <Minus className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon-sm" onClick={zoomIn} disabled={scale >= 4.0}>
          <Plus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={resetZoom}>
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  )
}
```

#### index.ts (위젯 배럴 export)

```typescript
export { PdfViewer } from './ui/PdfViewer'
```

### 6.5 PDF Page

**디렉토리**: `src/renderer/src/pages/pdf/`

#### ui/PdfPage.tsx

CsvPage 패턴 완전 복제: `setTabError`, 빈 ID 체크, `TabHeader isLoading` 스켈레톤, `FolderX` 에러 아이콘.

```tsx
import { JSX, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadPdfContent, PDF_EXTERNAL_CHANGED_EVENT } from '@entities/pdf-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { FolderX } from 'lucide-react'
import { PdfHeader } from '@features/pdf/view-pdf'
import { PdfViewer } from '@widgets/pdf-viewer'

export function PdfPage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const pdfId = params?.pdfId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useReadPdfContent(workspaceId, pdfId)

  // 에러 시 탭에 에러 상태 표시
  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

  // PDF_EXTERNAL_CHANGED_EVENT 리스닝 → refetch
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.pdfId === pdfId) {
        queryClient.refetchQueries({ queryKey: ['pdf', 'content', pdfId] })
      }
    }
    window.addEventListener(PDF_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(PDF_EXTERNAL_CHANGED_EVENT, handler)
  }, [pdfId, queryClient])

  // 빈 ID 체크
  if (!pdfId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">PDF 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  // 로딩 스켈레톤 (TabHeader isLoading)
  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }

  // 에러 상태 (FolderX 아이콘)
  if (isError || !data) {
    return (
      <TabContainer header={null}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground mt-20">
          <FolderX className="size-12" />
          <p className="text-sm">PDF를 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      scrollable={false}
      maxWidth="full"
      header={<PdfHeader workspaceId={workspaceId} pdfId={pdfId} tabId={tabId} />}
    >
      <PdfViewer data={data.data} />
    </TabContainer>
  )
}
```

#### index.ts (배럴 export)

```typescript
export { PdfPage } from './ui/PdfPage'
export default PdfPage
```

### 6.6 PDF Header (Feature)

**디렉토리**: `src/renderer/src/features/pdf/view-pdf/`

#### ui/PdfHeader.tsx

```tsx
import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { useRenamePdfFile, useUpdatePdfMeta, usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { FileType } from 'lucide-react'

interface PdfHeaderProps {
  workspaceId: string
  pdfId: string
  tabId?: string
}

export function PdfHeader({ workspaceId, pdfId, tabId }: PdfHeaderProps): JSX.Element {
  const { data: pdfFiles } = usePdfFilesByWorkspace(workspaceId)
  const pdf = pdfFiles?.find((p) => p.id === pdfId)
  const { mutate: renamePdf } = useRenamePdfFile()
  const { mutate: updateMeta } = useUpdatePdfMeta()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  return (
    <TabHeader
      editable
      icon={FileType}
      iconColor="#ef4444"
      title={pdf?.title ?? ''}
      description={pdf?.description ?? ''}
      onTitleChange={(title) => {
        renamePdf({ workspaceId, pdfId, newName: title })
        if (tabId) setTabTitle(tabId, title)
      }}
      onDescriptionChange={(desc) => {
        updateMeta({ workspaceId, pdfId, data: { description: desc } })
      }}
    />
  )
}
```

#### index.ts (배럴 export)

```typescript
export { PdfHeader } from './ui/PdfHeader'
```

---

## 7. Implementation Order

| # | Phase | 파일 수 | 설명 |
|---|-------|---------|------|
| 1 | A-1 | 2 | DB 스키마 + 마이그레이션 |
| 2 | 5A.1 | 1 | `schema/index.ts` — pdfFiles export |
| 3 | A-2 | 1 | Repository |
| 4 | A-3 | 1 | Service |
| 5 | A-4 | 1 | IPC 핸들러 (selectFile 포함) |
| 6 | 5A.2 | 1 | `main/index.ts` — registerPdfFileHandlers |
| 7 | A-5 | 1 | Leaf reindex 확장 |
| 8 | A-6 (5.2) | 1 | fs-utils 확장 |
| 9 | A-6 (5.3) | 1 | Workspace watcher 확장 |
| 10 | B-1~2 | 2 | Preload bridge (타입 + 구현) |
| 11 | C-1 | 1 | TabType + Route + Icon |
| 12 | C-2 | 5 | Entity layer |
| 13 | 5A.3 | 1 | `MainLayout.tsx` — usePdfWatcher |
| 14 | C-3 | 1 | 라우팅 등록 |
| 15 | D-1~4 | 8 | 폴더 트리 통합 (FolderContextMenu, PdfNodeRenderer, PdfContextMenu 포함) |
| 16 | E-1~2 | 4 | PDF 뷰어 위젯 (index.ts 배럴 포함) |
| 17 | F-1~2 | 4 | 페이지 (PdfPage + index.ts) + Feature (PdfHeader + index.ts) |

총 **~35개 파일** (신규 ~24, 수정 ~11)

> **사전 설치**: `npm install react-pdf pdfjs-dist` (구현 시작 전 실행)

---

## 8. 테스트 계획

### 8.1 Unit Tests

| 대상 | 파일 | 주요 케이스 |
|------|------|-------------|
| Repository | `repositories/__tests__/pdf-file.test.ts` | CRUD, createMany, bulkDeleteByPrefix, bulkUpdatePathPrefix, reindexSiblings |
| Service | `services/__tests__/pdf-file.test.ts` | import (copyFileSync), rename (renameSync), remove (unlinkSync), readContent (Buffer), move (reindex), readByWorkspace (orphan 삭제, 이동 감지) |
| usePdfViewer | `widgets/pdf-viewer/model/__tests__/use-pdf-viewer.test.ts` | goToPage 범위 제한, zoom 범위(0.25~4.0), onDocumentLoadSuccess numPages 설정 |
| buildWorkspaceTree | `features/folder/manage-folder/model/__tests__/use-workspace-tree.test.ts` | 기존 테스트에 pdfFiles 파라미터 추가, PDF 노드 정렬 |

### 8.2 Manual Verification

1. PDF 가져오기 → 폴더 트리에 표시, 탭 열기, 뷰어 렌더링
2. PDF 이름 변경 → disk 파일명 변경, 탭 제목 동기화
3. PDF 삭제 → disk 삭제, 트리/탭 제거
4. PDF 폴더 이동 (DnD) → disk 이동, folderId/order 갱신
5. 외부 변경 → toast 표시, 뷰어 자동 새로고침
6. 폴더 삭제 시 하위 PDF → DB에서 일괄 삭제, changed 이벤트 발생
7. 폴더 이름 변경 → PDF relativePath 일괄 갱신
8. 줌 인/아웃/리셋 → 범위 제한(0.25x~4.0x)
9. 페이지 네비게이션 → 첫/마지막 페이지 경계 처리
10. 동일 이름 PDF 가져오기 → resolveNameConflict 작동
11. 혼합 정렬 → 노트/CSV/PDF siblings order 통합 관리
12. pdfjs-dist worker 정상 로드 (Electron + Vite 환경)

---

## 9. 주의사항

- **의존성 설치**: 구현 시작 전 `npm install react-pdf pdfjs-dist` 실행 필수. `react-pdf`는 `pdfjs-dist`를 peer dependency로 요구.
- **pdfjs-dist worker**: Electron + Vite 환경에서 `import.meta.url` 기반 worker URL이 정상 동작하는지 구현 초기에 확인 필요. 실패 시 `electron.vite.config.ts`에 worker 설정 추가 또는 `pdf.worker.min.mjs`를 `public/` 디렉토리에 복사하는 방식으로 대체.
- **preview 필드**: PDF는 텍스트 미리보기 불가. 항상 빈 문자열 `''`. PdfTreeNode/PdfNodeRenderer에서 preview 영역을 숨기거나 "PDF 문서" 고정 문자열 표시.
- **FileType 아이콘**: `lucide-react`의 `FileType` 아이콘 사용. TypeScript 유틸 타입과 이름 충돌 없음 (import alias 불필요).
- **루트 레벨 PDF 가져오기**: 폴더 컨텍스트 메뉴뿐 아니라 트리 상단 툴바에도 PDF 가져오기 진입점 필요. 현재 노트 생성(`FilePlus`)과 폴더 생성(`FolderPlus`) 버튼이 있으므로, PDF 가져오기 버튼은 **구현 시 우선순위 낮음** — 폴더 컨텍스트 메뉴의 `onImportPdf`가 주 진입점이며, 루트 레벨 가져오기는 `handleImportPdf(null)`을 호출하는 툴바 버튼 추가로 대응 가능.
- **PDF 페이지 수 표시**: `PdfHeader`에 페이지 수를 표시할지는 구현 시 결정. `PdfViewer`의 `usePdfViewer`가 `numPages`를 관리하므로, 헤더에 전달하려면 state 끌어올리기 또는 Zustand 경유가 필요. v1에서는 `PdfToolbar`에서만 페이지 수 표시하고, 헤더 표시는 후속 개선으로 분류.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-03-01 | Initial draft |
| 0.2 | 2026-03-01 | 검증 피드백 15건 반영: workspace-watcher 전체 diff, 글루 파일 3개, queries/watcher/toolbar 전체 코드, FolderContextMenu diff, PdfPage imports, 테스트 계획, 주의사항 |
| 0.3 | 2026-03-01 | 2차 심층 검증 12건 반영: PdfPage CsvPage 패턴 완전 복제(H-1~H-2), PdfViewer import 보완(H-3), FolderTree pdfDeleteTarget/PdfNodeRenderer/PdfContextMenu 신규(H-4~H-5), PdfHeader interface+imports(M-1), useWorkspaceTree 전체 diff(M-2), 배럴 export 3개(M-3), tab-url.ts 정확한 diff(M-4), 의존성 설치 명령(M-5), 루트 PDF 가져오기 UX(M-6), isRemovingPdf(L-1), 페이지 수 표시 노트(L-2) |
