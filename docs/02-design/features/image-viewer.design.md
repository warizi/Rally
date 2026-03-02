# Image Viewer Design Document

> **Summary**: Rally 앱에 이미지 파일 뷰어를 추가한다. PDF 패턴을 복제하되 뷰어를 `react-zoom-pan-pinch` 기반 이미지 전용으로 교체.
>
> **Date**: 2026-03-02
> **Status**: Draft
> **Planning Doc**: [image-viewer.plan.md](../../01-plan/features/image-viewer.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- PDF 파일과 동일한 백엔드 패턴(DB → Repository → Service → IPC)으로 이미지 파일 관리
- `react-zoom-pan-pinch`로 줌/팬 기능 제공 (단일 이미지, 페이지 개념 없음)
- 탭 시스템 + 폴더 트리에 완전 통합
- Workspace Watcher로 외부 변경 실시간 감지
- 7개 이미지 확장자 지원: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`

### 1.2 Design Principles

- PDF 패턴 **그대로 복제** — 구조적 일관성 유지
- 읽기 전용 — `writeContent` 없음
- 바이너리 전달 — main: `Buffer`, renderer: `ArrayBuffer` (Electron structured clone)
- **다중 확장자 동적 처리** — 하드코딩 없이 `path.extname()` 기반 확장자 추출

---

## 2. Architecture

### 2.1 Data Flow

```
[Image Import]
  User → selectFile dialog (multiSelections) → fs.copyFileSync × N → DB insert × N → 마지막 이미지 탭 열기

[Image 렌더링]
  ImagePage → useReadImageContent(IPC) → ArrayBuffer → Blob → URL.createObjectURL → <img> + TransformWrapper

[외부 변경 감지]
  @parcel/watcher → applyEvents → pushImageChanged(IPC) → useImageWatcher → refetch + toast
```

### 2.2 Layer Map

```
┌─ Main Process ──────────────────────────────────────────────────┐
│  schema/image-file.ts → repositories/image-file.ts              │
│    → services/image-file.ts → ipc/image-file.ts                │
│  lib/leaf-reindex.ts (확장: kind 'image' 추가)                   │
│  lib/fs-utils.ts (확장: IMAGE_EXTENSIONS, isImageFile, 스캐너)   │
│  services/workspace-watcher.ts (확장: Steps 12-14)              │
│  db/schema/entity-link.ts (확장: 'image' 추가)                   │
│  services/entity-link.ts (확장: findEntity case 'image')        │
├─ Preload ───────────────────────────────────────────────────────┤
│  index.d.ts (ImageFileNode, ImageAPI, LinkableEntityType)       │
│  index.ts (image bridge)                                        │
├─ Renderer ──────────────────────────────────────────────────────┤
│  entities/image-file/ (queries, types, watcher, own-write)      │
│  features/folder/manage-folder/ (types, tree, FolderTree 확장)  │
│  features/image/view-image/ (ImageHeader)                       │
│  widgets/image-viewer/ (ImageViewer, ImageToolbar)               │
│  pages/image/ (ImagePage)                                       │
│  shared/constants/tab-url.ts (확장: 'image')                    │
│  shared/lib/entity-link.ts (확장: 'image' label/icon)           │
│  app/layout/model/pane-routes.tsx (확장)                         │
│  app/layout/MainLayout.tsx (확장: useImageWatcher)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 DB Schema

**파일**: `src/main/db/schema/image-file.ts`

```typescript
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { folders } from './folder'

export const imageFiles = sqliteTable(
  'image_files',
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

- `src/main/db/schema/index.ts`에 `imageFiles` export 추가
- `npm run db:generate` → `npm run db:migrate`

### 3.2 Repository

**파일**: `src/main/repositories/image-file.ts`

PDF repository 패턴 그대로 복제.

```typescript
import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '../db'
import { imageFiles } from '../db/schema'

export type ImageFile = typeof imageFiles.$inferSelect
export type ImageFileInsert = typeof imageFiles.$inferInsert

export const imageFileRepository = {
  findByWorkspaceId(workspaceId: string): ImageFile[] {
    return db.select().from(imageFiles).where(eq(imageFiles.workspaceId, workspaceId)).all()
  },

  findById(id: string): ImageFile | undefined {
    return db.select().from(imageFiles).where(eq(imageFiles.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): ImageFile | undefined {
    return db
      .select()
      .from(imageFiles)
      .where(and(eq(imageFiles.workspaceId, workspaceId), eq(imageFiles.relativePath, relativePath)))
      .get()
  },

  create(data: ImageFileInsert): ImageFile {
    return db.insert(imageFiles).values(data).returning().get()
  },

  createMany(items: ImageFileInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 99
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(imageFiles).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<ImageFile, 'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'>
    >
  ): ImageFile | undefined {
    return db.update(imageFiles).set(data).where(eq(imageFiles.id, id)).returning().get()
  },

  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(imageFiles).where(eq(imageFiles.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: imageFiles.id, relativePath: imageFiles.relativePath })
      .from(imageFiles)
      .where(eq(imageFiles.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(imageFiles).where(inArray(imageFiles.id, orphanIds.slice(i, i + CHUNK))).run()
    }
  },

  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(imageFiles)
      .where(and(eq(imageFiles.workspaceId, workspaceId), like(imageFiles.relativePath, `${prefix}/%`)))
      .run()
  },

  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE image_files
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
      `UPDATE image_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(imageFiles).where(eq(imageFiles.id, id)).run()
  }
}
```

### 3.3 Service

**파일**: `src/main/services/image-file.ts`

> **PDF 대비 핵심 차이 3가지**:
> 1. title 추출: `path.basename(name, path.extname(name))` (동적) vs `.replace(/\.pdf$/, '')` (하드코딩)
> 2. rename 시 원본 확장자 유지: `path.extname(image.relativePath)` 사용
> 3. move 시 kind: `'image'` vs `'pdf'`

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { imageFileRepository } from '../repositories/image-file'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readImageFilesRecursive } from '../lib/fs-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'
import { entityLinkService } from './entity-link'

export interface ImageFileNode {
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

function toImageFileNode(row: {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}): ImageFileNode {
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

export const imageFileService = {
  /** fs 스캔 + lazy upsert + orphan 삭제 */
  readByWorkspace(workspaceId: string): ImageFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    try {
      fs.accessSync(workspace.path)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspace.path}`)
    }

    const fsEntries = readImageFilesRecursive(workspace.path, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbRows = imageFileRepository.findByWorkspaceId(workspaceId)
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
    const toInsert: Parameters<typeof imageFileRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      if (matchedOrphan) {
        // ⚠️ title 추출: 동적 확장자 제거 (PDF와 다름)
        imageFileRepository.update(matchedOrphan.id, {
          relativePath: entry.relativePath,
          folderId: folder?.id ?? null,
          title: path.basename(entry.name, path.extname(entry.name)),
          updatedAt: now
        })
        orphanByBasename.delete(entry.name)
      } else {
        toInsert.push({
          id: nanoid(),
          workspaceId,
          folderId: folder?.id ?? null,
          relativePath: entry.relativePath,
          // ⚠️ title 추출: 동적 확장자 제거 (PDF와 다름)
          title: path.basename(entry.name, path.extname(entry.name)),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }
    imageFileRepository.createMany(toInsert)
    imageFileRepository.deleteOrphans(workspaceId, fsPaths)

    return imageFileRepository.findByWorkspaceId(workspaceId).map(toImageFileNode)
  },

  /** DB-only 조회 (IPC 핸들러용) */
  readByWorkspaceFromDb(workspaceId: string): ImageFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return imageFileRepository.findByWorkspaceId(workspaceId).map(toImageFileNode)
  },

  /** 외부 이미지를 workspace로 복사 + DB 등록 (단일 파일) */
  import(workspaceId: string, folderId: string | null, sourcePath: string): ImageFileNode {
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
    // ⚠️ title 추출: 동적 확장자 제거 (PDF와 다름)
    const title = path.basename(finalFileName, path.extname(finalFileName))

    const destAbs = path.join(parentAbs, finalFileName)
    const destRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )

    fs.copyFileSync(sourcePath, destAbs)

    const siblings = getLeafSiblings(workspaceId, folderId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = imageFileRepository.create({
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

    return toImageFileNode(row)
  },

  /** 이름 변경 (disk + DB) — 원본 확장자 유지 */
  rename(workspaceId: string, imageId: string, newName: string): ImageFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    if (newName.trim() === image.title) return toImageFileNode(image)

    const folderRel = parentRelPath(image.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    // ⚠️ PDF와 다름: 원본 확장자 동적 추출 (PDF는 '.pdf' 하드코딩)
    const ext = path.extname(image.relativePath) // ".png", ".jpg" 등
    const desiredFileName = newName.trim() + ext
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = path.basename(finalFileName, ext)

    const oldAbs = path.join(workspace.path, image.relativePath)
    const newRel = normalizePath(folderRel ? `${folderRel}/${finalFileName}` : finalFileName)
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)

    const updated = imageFileRepository.update(imageId, {
      relativePath: newRel,
      title,
      updatedAt: new Date()
    })!

    return toImageFileNode(updated)
  },

  /** 삭제 (disk + DB + entity links) */
  remove(workspaceId: string, imageId: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    const absPath = path.join(workspace.path, image.relativePath)
    try {
      fs.unlinkSync(absPath)
    } catch {
      // 이미 외부에서 삭제된 경우 무시
    }
    entityLinkService.removeAllLinks('image', imageId)
    imageFileRepository.delete(imageId)
  },

  /** 파일 읽기 → Buffer 반환 (renderer에서 ArrayBuffer로 수신) */
  readContent(workspaceId: string, imageId: string): { data: Buffer } {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    const absPath = path.join(workspace.path, image.relativePath)
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
    imageId: string,
    targetFolderId: string | null,
    index: number
  ): ImageFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    let targetFolderRel: string | null = null
    if (targetFolderId) {
      const folder = folderRepository.findById(targetFolderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${targetFolderId}`)
      targetFolderRel = folder.relativePath
    }

    const imageFileName = image.relativePath.split('/').at(-1)!
    const isSameFolder = image.folderId === targetFolderId

    let finalRel = image.relativePath
    let finalTitle = image.title

    if (!isSameFolder) {
      const parentAbs = targetFolderRel
        ? path.join(workspace.path, targetFolderRel)
        : workspace.path
      const finalFileName = resolveNameConflict(parentAbs, imageFileName)
      // ⚠️ title 추출: 동적 확장자 제거 (PDF와 다름)
      finalTitle = path.basename(finalFileName, path.extname(finalFileName))
      finalRel = normalizePath(
        targetFolderRel ? `${targetFolderRel}/${finalFileName}` : finalFileName
      )

      const oldAbs = path.join(workspace.path, image.relativePath)
      const newAbs = path.join(workspace.path, finalRel)
      fs.renameSync(oldAbs, newAbs)

      imageFileRepository.update(imageId, {
        folderId: targetFolderId,
        relativePath: finalRel,
        title: finalTitle,
        updatedAt: new Date()
      })
    }

    // 혼합 siblings reindex (note + csv + pdf + image)
    const siblings = getLeafSiblings(workspaceId, targetFolderId)
    const withoutSelf = siblings.filter((s) => s.id !== imageId)
    // ⚠️ kind: 'image' (PDF는 'pdf')
    withoutSelf.splice(index, 0, { id: imageId, kind: 'image', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      withoutSelf.map((s) => ({ id: s.id, kind: s.kind }))
    )

    const updated = imageFileRepository.findById(imageId)!
    return toImageFileNode(updated)
  },

  /** 메타데이터 업데이트 (description만) */
  updateMeta(
    _workspaceId: string,
    imageId: string,
    data: { description?: string }
  ): ImageFileNode {
    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    const updated = imageFileRepository.update(imageId, {
      ...data,
      updatedAt: new Date()
    })!

    return toImageFileNode(updated)
  }
}
```

---

## 4. IPC Specification

### 4.1 IPC 핸들러

**파일**: `src/main/ipc/image-file.ts`

```typescript
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { imageFileService } from '../services/image-file'

export function registerImageFileHandlers(): void {
  ipcMain.handle(
    'image:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => imageFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'image:import',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      sourcePath: string
    ): IpcResponse => handle(() => imageFileService.import(workspaceId, folderId, sourcePath))
  )

  ipcMain.handle(
    'image:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string, newName: string): IpcResponse =>
      handle(() => imageFileService.rename(workspaceId, imageId, newName))
  )

  ipcMain.handle(
    'image:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string): IpcResponse =>
      handle(() => imageFileService.remove(workspaceId, imageId))
  )

  ipcMain.handle(
    'image:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string): IpcResponse =>
      handle(() => imageFileService.readContent(workspaceId, imageId))
  )

  ipcMain.handle(
    'image:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      imageId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => imageFileService.move(workspaceId, imageId, folderId, index))
  )

  ipcMain.handle(
    'image:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      imageId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => imageFileService.updateMeta(workspaceId, imageId, data))
  )

  // ⚠️ PDF와 다름: multiSelections + 7개 확장자 필터 + string[] 반환
  ipcMain.handle('image:selectFile', async (): Promise<string[] | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }
      ]
    })
    return result.canceled ? null : result.filePaths
  })
}
```

### 4.2 채널 목록

| 채널 | 파라미터 | 반환 |
|------|---------|------|
| `image:readByWorkspace` | `workspaceId` | `IpcResponse<ImageFileNode[]>` |
| `image:import` | `workspaceId, folderId, sourcePath` | `IpcResponse<ImageFileNode>` |
| `image:rename` | `workspaceId, imageId, newName` | `IpcResponse<ImageFileNode>` |
| `image:remove` | `workspaceId, imageId` | `IpcResponse<void>` |
| `image:readContent` | `workspaceId, imageId` | `IpcResponse<{ data: Buffer }>` |
| `image:move` | `workspaceId, imageId, folderId, index` | `IpcResponse<ImageFileNode>` |
| `image:updateMeta` | `workspaceId, imageId, data` | `IpcResponse<ImageFileNode>` |
| `image:selectFile` | (없음) | `string[] \| null` |

> PDF 대비 차이: `selectFile`이 `string[]` 반환 (다중 선택), PDF는 `string` 반환 (단일 선택)

---

## 5. 기존 파일 수정 상세

### 5.1 Leaf Reindex 확장

**파일**: `src/main/lib/leaf-reindex.ts`

```diff
  import { pdfFileRepository } from '../repositories/pdf-file'
+ import { imageFileRepository } from '../repositories/image-file'

  export interface LeafSibling {
    id: string
-   kind: 'note' | 'csv' | 'pdf'
+   kind: 'note' | 'csv' | 'pdf' | 'image'
    order: number
  }

  export function getLeafSiblings(workspaceId: string, folderId: string | null): LeafSibling[] {
    const notes = noteRepository.findByWorkspaceId(workspaceId)
      .filter((n) => n.folderId === folderId)
      .map((n) => ({ id: n.id, kind: 'note' as const, order: n.order }))
    const csvs = csvFileRepository.findByWorkspaceId(workspaceId)
      .filter((c) => c.folderId === folderId)
      .map((c) => ({ id: c.id, kind: 'csv' as const, order: c.order }))
    const pdfs = pdfFileRepository.findByWorkspaceId(workspaceId)
      .filter((p) => p.folderId === folderId)
      .map((p) => ({ id: p.id, kind: 'pdf' as const, order: p.order }))
+   const images = imageFileRepository.findByWorkspaceId(workspaceId)
+     .filter((i) => i.folderId === folderId)
+     .map((i) => ({ id: i.id, kind: 'image' as const, order: i.order }))
-   return [...notes, ...csvs, ...pdfs].sort((a, b) => a.order - b.order)
+   return [...notes, ...csvs, ...pdfs, ...images].sort((a, b) => a.order - b.order)
  }

  export function reindexLeafSiblings(
    workspaceId: string,
-   orderedItems: Array<{ id: string; kind: 'note' | 'csv' | 'pdf' }>
+   orderedItems: Array<{ id: string; kind: 'note' | 'csv' | 'pdf' | 'image' }>
  ): void {
    const now = Date.now()
    const noteStmt = db.$client.prepare(...)
    const csvStmt = db.$client.prepare(...)
    const pdfStmt = db.$client.prepare(...)
+   const imageStmt = db.$client.prepare(
+     `UPDATE image_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
+   )
    db.$client.transaction(() => {
      orderedItems.forEach((item, i) => {
        if (item.kind === 'note') noteStmt.run(i, now, workspaceId, item.id)
        else if (item.kind === 'csv') csvStmt.run(i, now, workspaceId, item.id)
-       else pdfStmt.run(i, now, workspaceId, item.id)
+       else if (item.kind === 'pdf') pdfStmt.run(i, now, workspaceId, item.id)
+       else imageStmt.run(i, now, workspaceId, item.id)
      })
    })()
  }
```

### 5.2 fs-utils 확장

**파일**: `src/main/lib/fs-utils.ts`

```typescript
// ─── 기존 MdFileEntry, CsvFileEntry, PdfFileEntry 패턴에 추가 ───

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

export interface ImageFileEntry {
  name: string
  relativePath: string
}

export function readImageFilesRecursive(absBase: string, parentRel: string): ImageFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: ImageFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readImageFilesRecursive(absBase, rel))
    } else if (entry.isFile() && isImageFile(entry.name)) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

export async function readImageFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<ImageFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: ImageFileEntry[] = []
  const subDirPromises: Promise<ImageFileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      subDirPromises.push(readImageFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && isImageFile(entry.name)) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  const subResults = await Promise.all(subDirPromises)
  return result.concat(...subResults)
}
```

> **PDF와의 차이**: PDF는 `entry.name.endsWith('.pdf')` 단일 체크, Image는 `isImageFile(entry.name)`으로 7개 확장자 체크

### 5.3 Workspace Watcher 확장

**파일**: `src/main/services/workspace-watcher.ts`

#### 5.3.1 import 추가

```diff
  import { pdfFileRepository } from '../repositories/pdf-file'
+ import { imageFileRepository } from '../repositories/image-file'
- import { readMdFilesRecursiveAsync, readCsvFilesRecursiveAsync, readPdfFilesRecursiveAsync } from '../lib/fs-utils'
+ import { readMdFilesRecursiveAsync, readCsvFilesRecursiveAsync, readPdfFilesRecursiveAsync, readImageFilesRecursiveAsync, isImageFile } from '../lib/fs-utils'
```

#### 5.3.2 `start()` — imageReconciliation + pushImageChanged 추가

```diff
    try {
      await this.pdfReconciliation(workspaceId, workspacePath)
    } catch {
      /* ignore */
    }
+   try {
+     await this.imageReconciliation(workspaceId, workspacePath)
+   } catch {
+     /* ignore — watcher continues without initial image sync */
+   }

    this.pushFolderChanged(workspaceId, [])
    this.pushNoteChanged(workspaceId, [])
    this.pushCsvChanged(workspaceId, [])
    this.pushPdfChanged(workspaceId, [])
+   this.pushImageChanged(workspaceId, [])
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
    orphanPdfPaths: string[]
+   orphanImagePaths: string[]
  }> {
    const changedFolderPaths: string[] = []
    const orphanNotePaths: string[] = []
    const orphanCsvPaths: string[] = []
    const orphanPdfPaths: string[] = []
+   const orphanImagePaths: string[] = []
```

#### 5.3.4 Step 2 (폴더 rename) — bulkUpdatePathPrefix 추가

```diff
          pdfFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
+         imageFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
```

> oldPath rename 분기에서도 동일:

```diff
        pdfFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
+       imageFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
```

#### 5.3.5 Step 2 — 이미지 파일 필터 추가

```diff
      if (absPath.endsWith('.md')) continue
      if (absPath.endsWith('.csv')) continue
      if (absPath.endsWith('.pdf')) continue
+     if (isImageFile(absPath)) continue
```

#### 5.3.6 Step 2 (폴더 delete) — orphanImagePaths 수집 + bulkDeleteByPrefix

```diff
          const childPdfs = pdfFileRepository
            .findByWorkspaceId(workspaceId)
            .filter((p) => p.relativePath.startsWith(rel + '/'))
+         const childImages = imageFileRepository
+           .findByWorkspaceId(workspaceId)
+           .filter((i) => i.relativePath.startsWith(rel + '/'))
          orphanPdfPaths.push(...childPdfs.map((p) => p.relativePath))
+         orphanImagePaths.push(...childImages.map((i) => i.relativePath))

+         // image entity link 정리
+         for (const img of childImages) {
+           entityLinkRepository.removeAllByEntity('image', img.id)
+         }

          pdfFileRepository.bulkDeleteByPrefix(workspaceId, rel)
+         imageFileRepository.bulkDeleteByPrefix(workspaceId, rel)
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
```

#### 5.3.7 Steps 12~14 (신규) — 이미지 파일 rename/move/create/delete

PDF Steps 9~11을 복제하여 이미지 전용 블록 추가. Step 11 다음에 삽입:

```typescript
    // ─── Step 12: 이미지 파일 rename/move 감지 ──────────────────────
    const imageDeletes = events.filter(
      (e) =>
        e.type === 'delete' && isImageFile(e.path) && !path.basename(e.path).startsWith('.')
    )
    const imageCreates = events.filter(
      (e) =>
        e.type === 'create' && isImageFile(e.path) && !path.basename(e.path).startsWith('.')
    )
    const pairedImageDeletePaths = new Set<string>()
    const pairedImageCreatePaths = new Set<string>()
    for (const createEvent of imageCreates) {
      const createDir = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      const matchingDelete =
        imageDeletes.find(
          (d) => !pairedImageDeletePaths.has(d.path) && path.dirname(d.path) === createDir
        ) ??
        imageDeletes.find(
          (d) => !pairedImageDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existing = imageFileRepository.findByRelativePath(workspaceId, oldRel)
        if (existing) {
          const newParentRel = newRel.includes('/')
            ? newRel.split('/').slice(0, -1).join('/')
            : null
          const newFolder = newParentRel
            ? folderRepository.findByRelativePath(workspaceId, newParentRel)
            : null
          // ⚠️ title 추출: 동적 확장자 제거
          imageFileRepository.update(existing.id, {
            relativePath: newRel,
            folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
            title: path.basename(createEvent.path, path.extname(createEvent.path)),
            updatedAt: new Date()
          })
          pairedImageDeletePaths.add(matchingDelete.path)
          pairedImageCreatePaths.add(createEvent.path)
        }
      }
    }

    // ─── Step 13: standalone Image create → DB에 이미지 추가 ────────
    for (const createEvent of imageCreates) {
      if (pairedImageCreatePaths.has(createEvent.path)) continue
      const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = imageFileRepository.findByRelativePath(workspaceId, rel)
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
        imageFileRepository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          folderId: folder?.id ?? null,
          // ⚠️ title 추출: 동적 확장자 제거
          title: path.basename(createEvent.path, path.extname(createEvent.path)),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }

    // ─── Step 14: standalone Image delete → DB에서 이미지 삭제 ──────
    for (const deleteEvent of imageDeletes) {
      if (pairedImageDeletePaths.has(deleteEvent.path)) continue
      const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
      const existing = imageFileRepository.findByRelativePath(workspaceId, rel)
      if (existing) {
        entityLinkRepository.removeAllByEntity('image', existing.id)
        imageFileRepository.delete(existing.id)
      }
    }
```

> **PDF와의 차이**:
> - 필터: `e.path.endsWith('.pdf')` → `isImageFile(e.path)` (7개 확장자)
> - title: `path.basename(p, '.pdf')` → `path.basename(p, path.extname(p))` (동적)
> - delete 시 `entityLinkRepository.removeAllByEntity('image', id)` 호출 추가

#### 5.3.8 `applyEvents()` return 변경

```diff
-   return { folderPaths: changedFolderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths }
+   return { folderPaths: changedFolderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths, orphanImagePaths }
```

#### 5.3.9 `handleEvents()` — Image 변경 수집 + pushImageChanged

```diff
        const { folderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths, orphanImagePaths } = await this.applyEvents(
          workspaceId,
          workspacePath,
          eventsToProcess
        )
        // ... (기존 folder, note, csv, pdf changed 처리) ...

+       // 변경된 이미지 파일 경로 수집 + 폴더 삭제로 함께 삭제된 Image 경로 병합
+       const changedImageRelPaths = [
+         ...eventsToProcess
+           .filter((e) => isImageFile(e.path) && !path.basename(e.path).startsWith('.'))
+           .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
+         ...orphanImagePaths
+       ]
+       this.pushImageChanged(workspaceId, changedImageRelPaths)
```

#### 5.3.10 `imageReconciliation()` — pdfReconciliation 복제

```typescript
  private async imageReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = await readImageFilesRecursiveAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbImages = imageFileRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbImages.map((i) => i.relativePath))

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
          // ⚠️ title 추출: 동적 확장자 제거
          title: path.basename(e.name, path.extname(e.name)),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })

    imageFileRepository.createMany(toInsert)
    imageFileRepository.deleteOrphans(workspaceId, fsPaths)
  }
```

#### 5.3.11 `pushImageChanged()` — pushPdfChanged 복제

```typescript
  private pushImageChanged(workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('image:changed', workspaceId, changedRelPaths)
    })
  }
```

### 5.4 Entity Link 확장

**파일 1**: `src/main/db/schema/entity-link.ts`

```diff
- export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'
+ export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'

  export const LINKABLE_ENTITY_TYPES: LinkableEntityType[] = [
    'csv',
+   'image',
    'note',
    'pdf',
    'schedule',
    'todo'
  ]
```

**파일 2**: `src/main/services/entity-link.ts` — `findEntity()` switch문 확장

```diff
+ import { imageFileRepository } from '../repositories/image-file'

  function findEntity(type: LinkableEntityType, id: string) {
    switch (type) {
      case 'todo': return todoRepository.findById(id)
      case 'schedule': return scheduleRepository.findById(id) as { workspaceId: string; title: string } | undefined
      case 'note': return noteRepository.findById(id)
      case 'pdf': return pdfFileRepository.findById(id)
      case 'csv': return csvFileRepository.findById(id)
+     case 'image': return imageFileRepository.findById(id)
    }
  }
```

> **누락 시 런타임 에러**: findEntity()에 'image' case가 없으면 entity link 조회/생성 시 undefined 반환 → NotFoundError 발생

### 5.5 Preload Bridge

**파일**: `src/preload/index.d.ts` — 타입 추가

```typescript
interface ImageFileNode {
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

interface ImageAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<ImageFileNode[]>>
  import: (workspaceId: string, folderId: string | null, sourcePath: string) => Promise<IpcResponse<ImageFileNode>>
  rename: (workspaceId: string, imageId: string, newName: string) => Promise<IpcResponse<ImageFileNode>>
  remove: (workspaceId: string, imageId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, imageId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (workspaceId: string, imageId: string, folderId: string | null, index: number) => Promise<IpcResponse<ImageFileNode>>
  updateMeta: (workspaceId: string, imageId: string, data: { description?: string }) => Promise<IpcResponse<ImageFileNode>>
  selectFile: () => Promise<string[] | null>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

// LinkableEntityType 에도 'image' 추가
type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'

interface API {
  // ...기존...
  pdf: PdfAPI
+ image: ImageAPI
  folder: FolderAPI
}
```

> `selectFile` 반환 타입이 `string[]` (PDF의 `string`과 다름)

**파일**: `src/preload/index.ts` — bridge 구현

```typescript
image: {
  readByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('image:readByWorkspace', workspaceId),
  import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
    ipcRenderer.invoke('image:import', workspaceId, folderId, sourcePath),
  rename: (workspaceId: string, imageId: string, newName: string) =>
    ipcRenderer.invoke('image:rename', workspaceId, imageId, newName),
  remove: (workspaceId: string, imageId: string) =>
    ipcRenderer.invoke('image:remove', workspaceId, imageId),
  readContent: (workspaceId: string, imageId: string) =>
    ipcRenderer.invoke('image:readContent', workspaceId, imageId),
  move: (workspaceId: string, imageId: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke('image:move', workspaceId, imageId, folderId, index),
  updateMeta: (workspaceId: string, imageId: string, data: { description?: string }) =>
    ipcRenderer.invoke('image:updateMeta', workspaceId, imageId, data),
  selectFile: () => ipcRenderer.invoke('image:selectFile'),
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      workspaceId: string,
      changedRelPaths: string[]
    ): void => callback(workspaceId, changedRelPaths)
    ipcRenderer.on('image:changed', handler)
    return () => ipcRenderer.removeListener('image:changed', handler)
  }
},
```

---

## 5A. Glue File Registrations

> 사소하지만 빠뜨리면 런타임에서 실패하는 등록 파일들.

### 5A.1 `src/main/db/schema/index.ts` — imageFiles export

```diff
  import { pdfFiles } from './pdf-file'
+ import { imageFiles } from './image-file'

- export { workspaces, tabSessions, tabSnapshots, folders, notes, csvFiles, pdfFiles, todos, appSettings, schedules, scheduleTodos, entityLinks }
+ export { workspaces, tabSessions, tabSnapshots, folders, notes, csvFiles, pdfFiles, imageFiles, todos, appSettings, schedules, scheduleTodos, entityLinks }
```

### 5A.2 `src/main/index.ts` — registerImageFileHandlers 등록

```diff
  import { registerPdfFileHandlers } from './ipc/pdf-file'
+ import { registerImageFileHandlers } from './ipc/image-file'

  // ... app.whenReady().then(() => { ... })
  registerPdfFileHandlers()
+ registerImageFileHandlers()
```

### 5A.3 `src/renderer/src/app/layout/MainLayout.tsx` — useImageWatcher 등록

```diff
  import { usePdfWatcher } from '@entities/pdf-file'
+ import { useImageWatcher } from '@entities/image-file'

  function MainLayout(): React.JSX.Element {
    useSessionPersistence()
    useFolderWatcher()
    useNoteWatcher()
    useCsvWatcher()
    usePdfWatcher()
+   useImageWatcher()
```

> **누락 시**: 외부에서 이미지 파일 추가/삭제/교체해도 UI에 반영되지 않음

---

## 6. Renderer 설계

### 6.1 Entity Layer

**디렉토리**: `src/renderer/src/entities/image-file/`

#### model/types.ts
```typescript
export interface ImageFileNode {
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

#### model/own-write-tracker.ts
```typescript
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

export function markAsOwnWrite(imageId: string): void {
  const prev = pendingWrites.get(imageId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(imageId), 2000)
  pendingWrites.set(imageId, timer)
}

export function isOwnWrite(imageId: string): boolean {
  return pendingWrites.has(imageId)
}
```

#### api/queries.ts

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
import type { ImageFileNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { markAsOwnWrite } from '../model/own-write-tracker'

const IMAGE_KEY = 'image'

export function useImageFilesByWorkspace(workspaceId: string): UseQueryResult<ImageFileNode[]> {
  return useQuery({
    queryKey: [IMAGE_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<ImageFileNode[]> => {
      const res: IpcResponse<ImageFileNode[]> = await window.api.image.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useImportImageFile(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; sourcePath: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, sourcePath }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.import(
        workspaceId,
        folderId,
        sourcePath
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenameImageFile(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; imageId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, imageId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(imageId)
    },
    mutationFn: async ({ workspaceId, imageId, newName }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.rename(
        workspaceId,
        imageId,
        newName
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveImageFile(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; imageId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, imageId }) => {
      const res: IpcResponse<void> = await window.api.image.remove(workspaceId, imageId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadImageContent(
  workspaceId: string,
  imageId: string
): UseQueryResult<{ data: ArrayBuffer }> {
  return useQuery({
    queryKey: [IMAGE_KEY, 'content', imageId],
    queryFn: async (): Promise<{ data: ArrayBuffer }> => {
      const res: IpcResponse<{ data: ArrayBuffer }> = await window.api.image.readContent(
        workspaceId,
        imageId
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? { data: new ArrayBuffer(0) }
    },
    enabled: !!workspaceId && !!imageId,
    staleTime: Infinity
  })
}

export function useMoveImageFile(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; imageId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, imageId, folderId, index }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.move(
        workspaceId,
        imageId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateImageMeta(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; imageId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, imageId, data }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.updateMeta(
        workspaceId,
        imageId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}
```

#### model/use-image-watcher.ts

```typescript
import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { ImageFileNode } from './types'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const IMAGE_EXTERNAL_CHANGED_EVENT = 'image:external-changed'

/** MainLayout에서 호출 — image:changed push 이벤트 구독 + React Query invalidation */
export function useImageWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.image.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      // Image 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['image', 'workspace', workspaceId] })

      // 변경된 파일 중 외부 변경만 처리
      const images = queryClient.getQueryData<ImageFileNode[]>(['image', 'workspace', workspaceId])
      if (images && changedRelPaths.length > 0) {
        const externalImages = images.filter(
          (i) =>
            changedRelPaths.includes(i.relativePath) &&
            !isOwnWrite(i.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )
        if (readyRef.current && externalImages.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalImages.map((i) =>
                createElement(
                  'li',
                  { key: i.id, className: 'flex items-center gap-1.5' },
                  createElement(ImageIcon, { className: 'size-3.5 shrink-0' }),
                  i.title
                )
              )
            )
          })
        }
        externalImages.forEach((i) => {
          queryClient.refetchQueries({ queryKey: ['image', 'content', i.id] }).then(() => {
            window.dispatchEvent(
              new CustomEvent(IMAGE_EXTERNAL_CHANGED_EVENT, { detail: { imageId: i.id } })
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

> **PDF와의 차이**: 아이콘 `PdfIcon` → `ImageIcon`, 이벤트 이름 `pdf:external-changed` → `image:external-changed`

#### index.ts
```typescript
export type { ImageFileNode } from './model/types'
export {
  useImageFilesByWorkspace,
  useImportImageFile,
  useRenameImageFile,
  useRemoveImageFile,
  useReadImageContent,
  useMoveImageFile,
  useUpdateImageMeta
} from './api/queries'
export { isOwnWrite } from './model/own-write-tracker'
export { useImageWatcher } from './model/use-image-watcher'
export { IMAGE_EXTERNAL_CHANGED_EVENT } from './model/use-image-watcher'
```

### 6.2 Tab System + Routing + Entity Link

**`src/renderer/src/shared/constants/tab-url.ts`**:
```diff
  import {
    Calendar,
    Check,
    FileText,
    FolderOpen,
+   ImageIcon,
    LayoutDashboard,
    Sheet
  } from 'lucide-react'
  import { PdfIcon } from '@shared/ui/icons/PdfIcon'

- export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'pdf' | 'calendar'
+ export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'pdf' | 'image' | 'calendar'

  export const TAB_ICON: Record<TabIcon, React.ElementType> = {
    // ...기존 항목...
    pdf: PdfIcon,
+   image: ImageIcon,
    calendar: Calendar
  }

  export const ROUTES = {
    // ...기존 항목...
    PDF_DETAIL: '/folder/pdf/:pdfId',
+   IMAGE_DETAIL: '/folder/image/:imageId',
    CALENDAR: '/calendar'
  } as const
```

**`src/renderer/src/app/layout/model/pane-routes.tsx`**:
```diff
  const PdfPage = lazy(() => import('@pages/pdf'))
+ const ImagePage = lazy(() => import('@pages/image'))
  const CalendarPage = lazy(() => import('@pages/calendar'))

  // PANE_ROUTES 배열 내 PDF_DETAIL 다음, CALENDAR 앞에 추가:
  {
    pattern: ROUTES.PDF_DETAIL,
    component: PdfPage
  },
+ {
+   pattern: ROUTES.IMAGE_DETAIL,
+   component: ImagePage
+ },
  {
    pattern: ROUTES.CALENDAR,
    component: CalendarPage
  }
```

**`src/renderer/src/shared/lib/entity-link.ts`** — Entity Link 레이블/아이콘:

```diff
- import { Check, Calendar, FileText, Sheet } from 'lucide-react'
+ import { Check, Calendar, FileText, ImageIcon, Sheet } from 'lucide-react'
  import { PdfIcon } from '@shared/ui/icons/PdfIcon'

  // LinkableEntityType에 'image' 추가
- export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'
+ export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'

  export const ENTITY_TYPE_LABEL: Record<LinkableEntityType, string> = {
    // ...기존...
    csv: 'CSV',
+   image: '이미지'
  }

  export const ENTITY_TYPE_ICON: Record<LinkableEntityType, React.ElementType> = {
    // ...기존...
    pdf: PdfIcon,
    csv: Sheet,
+   image: ImageIcon
  }
```

**`src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts`**:

```diff
  // toTabOptions() switch문에 case 추가
+ case 'image':
+   return { type: 'image', pathname: `/folder/image/${linkedId}`, title }
```

> **누락 시**: Entity link에서 이미지 클릭해도 탭이 열리지 않음 (null 반환)

### 6.3 Folder Tree Integration

#### types.ts 수정

```diff
+ export interface ImageTreeNode {
+   kind: 'image'
+   id: string
+   name: string
+   relativePath: string
+   description: string
+   preview: string
+   folderId: string | null
+   order: number
+ }

- export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode | PdfTreeNode
+ export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode | PdfTreeNode | ImageTreeNode
```

#### use-workspace-tree.ts 수정

**파일**: `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts`

##### import 추가

```diff
  import { usePdfFilesByWorkspace } from '@entities/pdf-file'
+ import { useImageFilesByWorkspace } from '@entities/image-file'
+ import type { ImageFileNode } from '@entities/image-file'
+ import type { ImageTreeNode } from './types'
```

##### buildWorkspaceTree 시그니처 + 내부

```diff
  export function buildWorkspaceTree(
    folders: FolderNode[],
    notes: NoteNode[],
    csvFiles: CsvFileNode[],
-   pdfFiles: PdfFileNode[]
+   pdfFiles: PdfFileNode[],
+   imageFiles: ImageFileNode[]
  ): WorkspaceTreeNode[] {

+   function convertImage(img: ImageFileNode): ImageTreeNode {
+     return {
+       kind: 'image',
+       id: img.id,
+       name: img.title,
+       relativePath: img.relativePath,
+       description: img.description,
+       preview: img.preview,
+       folderId: img.folderId,
+       order: img.order
+     }
+   }

    function getLeafChildren(folderId: string | null): WorkspaceTreeNode[] {
      const childNotes = notes.filter((n) => n.folderId === folderId).map(convertNote)
      const childCsvs = csvFiles.filter((c) => c.folderId === folderId).map(convertCsv)
      const childPdfs = pdfFiles.filter((p) => p.folderId === folderId).map(convertPdf)
+     const childImages = imageFiles.filter((i) => i.folderId === folderId).map(convertImage)
-     return [...childNotes, ...childCsvs, ...childPdfs].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
+     return [...childNotes, ...childCsvs, ...childPdfs, ...childImages].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    }
  }
```

##### useWorkspaceTree 훅 변경

```diff
  export function useWorkspaceTree(workspaceId: string) {
    const { data: pdfFiles = [], isLoading: isPdfsLoading } = usePdfFilesByWorkspace(workspaceId)
+   const { data: imageFiles = [], isLoading: isImagesLoading } = useImageFilesByWorkspace(workspaceId)

-   const tree = buildWorkspaceTree(folders, notes, csvFiles, pdfFiles)
+   const tree = buildWorkspaceTree(folders, notes, csvFiles, pdfFiles, imageFiles)

-   return { tree, isLoading: isFoldersLoading || isNotesLoading || isCsvsLoading || isPdfsLoading }
+   return { tree, isLoading: isFoldersLoading || isNotesLoading || isCsvsLoading || isPdfsLoading || isImagesLoading }
  }
```

#### FolderTree.tsx 수정

**파일**: `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`

##### import 추가

```diff
  import { useImportPdfFile, useMovePdfFile, useRemovePdfFile } from '@entities/pdf-file'
+ import { useImportImageFile, useMoveImageFile, useRemoveImageFile } from '@entities/image-file'
+ import type { ImageFileNode } from '@entities/image-file'
  import type { PdfTreeNode } from '../model/types'
+ import type { ImageTreeNode } from '../model/types'
  import { PdfContextMenu } from './PdfContextMenu'
  import { PdfNodeRenderer } from './PdfNodeRenderer'
+ import { ImageContextMenu } from './ImageContextMenu'
+ import { ImageNodeRenderer } from './ImageNodeRenderer'
```

##### 뮤테이션 + 상태 추가

```diff
  // PDF mutations
  const { mutate: importPdfFile } = useImportPdfFile()
  const { mutate: movePdfFile } = useMovePdfFile()
  const { mutate: removePdfFile, isPending: isRemovingPdf } = useRemovePdfFile()

+ // Image mutations — mutateAsync for multi-file import loop
+ const { mutateAsync: importImageFile } = useImportImageFile()
+ const { mutate: moveImageFile } = useMoveImageFile()
+ const { mutate: removeImageFile, isPending: isRemovingImage } = useRemoveImageFile()

  const [pdfDeleteTarget, setPdfDeleteTarget] = useState<{ id: string; name: string } | null>(null)
+ const [imageDeleteTarget, setImageDeleteTarget] = useState<{ id: string; name: string } | null>(null)
```

> **PDF와의 패턴 차이**: Image import는 `mutateAsync` 사용 (다중 파일 루프), PDF는 `mutate` + `onSuccess` 콜백

##### Image 가져오기 핸들러 추가

```typescript
/** 이미지 가져오기 → selectFile 다이얼로그 (다중 선택) → import × N → 마지막 이미지만 탭 열기 */
const handleImportImage = useCallback(
  async (folderId: string | null) => {
    const filePaths = await window.api.image.selectFile()
    if (!filePaths || filePaths.length === 0) return
    let lastImported: ImageFileNode | undefined
    for (const sourcePath of filePaths) {
      lastImported = await importImageFile({ workspaceId, folderId, sourcePath })
    }
    if (lastImported) {
      openRightTab(
        {
          type: 'image',
          title: lastImported.title,
          pathname: `/folder/image/${lastImported.id}`
        },
        sourcePaneId
      )
    }
  },
  [workspaceId, sourcePaneId, importImageFile, openRightTab]
)
```

> **PDF와의 차이**: PDF는 단일 파일 `mutate()` + `onSuccess`, Image는 다중 파일 `mutateAsync()` + for-of await. 마지막 결과만 탭으로 열기.

##### NodeRenderer에 Image 분기 추가 (PDF 분기 다음)

```diff
      if (props.node.data.kind === 'pdf') {
        return (
          <PdfContextMenu ...>
            <div><PdfNodeRenderer ... /></div>
          </PdfContextMenu>
        )
      }

+     if (props.node.data.kind === 'image') {
+       return (
+         <ImageContextMenu
+           onDelete={() =>
+             setImageDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
+           }
+         >
+           <div>
+             <ImageNodeRenderer
+               {...(props as unknown as NodeRendererProps<ImageTreeNode>)}
+               onOpen={() =>
+                 openRightTab(
+                   {
+                     type: 'image',
+                     title: props.node.data.name,
+                     pathname: `/folder/image/${props.node.data.id}`
+                   },
+                   sourcePaneId
+                 )
+               }
+             />
+           </div>
+         </ImageContextMenu>
+       )
+     }

      // kind === 'folder'
```

##### 가드 수정

```diff
  disableDrop={({ parentNode }) =>
-   parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv' || parentNode?.data.kind === 'pdf'
+   parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv' || parentNode?.data.kind === 'pdf' || parentNode?.data.kind === 'image'
  }
  disableEdit={(n) =>
-   n.kind === 'note' || n.kind === 'csv' || n.kind === 'pdf'
+   n.kind === 'note' || n.kind === 'csv' || n.kind === 'pdf' || n.kind === 'image'
  }
```

##### onMove에 Image 분기 추가

```diff
  onMove={({ dragIds, dragNodes, parentId, index }) => {
    const kind = dragNodes[0]?.data.kind
    if (kind === 'note') {
      moveNote({ workspaceId, noteId: dragIds[0], folderId: parentId ?? null, index })
    } else if (kind === 'csv') {
      moveCsvFile({ workspaceId, csvId: dragIds[0], folderId: parentId ?? null, index })
    } else if (kind === 'pdf') {
      movePdfFile({ workspaceId, pdfId: dragIds[0], folderId: parentId ?? null, index })
+   } else if (kind === 'image') {
+     moveImageFile({ workspaceId, imageId: dragIds[0], folderId: parentId ?? null, index })
    } else {
      move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
    }
  }}
```

##### onDelete에 Image 분기 추가

```diff
  onDelete={({ ids, nodes }) => {
    const firstNode = nodes[0]
    if (firstNode.data.kind === 'note') {
      setNoteDeleteTarget({ id: ids[0], name: firstNode.data.name })
    } else if (firstNode.data.kind === 'csv') {
      setCsvDeleteTarget({ id: ids[0], name: firstNode.data.name })
    } else if (firstNode.data.kind === 'pdf') {
      setPdfDeleteTarget({ id: ids[0], name: firstNode.data.name })
+   } else if (firstNode.data.kind === 'image') {
+     setImageDeleteTarget({ id: ids[0], name: firstNode.data.name })
    } else {
      setDeleteTarget({ id: ids[0], name: firstNode.data.name })
    }
  }}
```

##### FolderContextMenu에 onImportImage prop 전달

```diff
  <FolderContextMenu
    onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
    onCreateNote={() => handleCreateNote(props.node.id)}
    onCreateCsv={() => handleCreateCsv(props.node.id)}
    onImportPdf={() => handleImportPdf(props.node.id)}
+   onImportImage={() => handleImportImage(props.node.id)}
    onRename={() => ...}
    onEditColor={() => ...}
    onDelete={() => ...}
  >
```

##### Image 삭제 다이얼로그 (PDF 삭제 다이얼로그 다음에 추가)

```tsx
{/* Image 삭제 다이얼로그 — DeleteFolderDialog 재사용 */}
<DeleteFolderDialog
  open={imageDeleteTarget !== null}
  onOpenChange={(open) => {
    if (!open) setImageDeleteTarget(null)
  }}
  folderName={imageDeleteTarget?.name ?? ''}
  isPending={isRemovingImage}
  onConfirm={() => {
    if (imageDeleteTarget) {
      removeImageFile(
        { workspaceId, imageId: imageDeleteTarget.id },
        { onSuccess: () => setImageDeleteTarget(null) }
      )
    }
  }}
/>
```

#### ImageNodeRenderer.tsx (신규)

**파일**: `src/renderer/src/features/folder/manage-folder/ui/ImageNodeRenderer.tsx`

```tsx
import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ImageIcon } from 'lucide-react'
import type { ImageTreeNode } from '../model/types'

interface ImageNodeRendererProps extends NodeRendererProps<ImageTreeNode> {
  onOpen: () => void
}

export function ImageNodeRenderer({ node, style, dragHandle, onOpen }: ImageNodeRendererProps): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <ImageIcon className="ml-1 size-4 shrink-0 text-sky-500" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

> 아이콘 색상: sky-500 (PDF는 red-500, CSV는 emerald-500)

#### ImageContextMenu.tsx (신규)

**파일**: `src/renderer/src/features/folder/manage-folder/ui/ImageContextMenu.tsx`

PdfContextMenu 패턴 복제. 삭제만 제공.

```tsx
import { JSX } from 'react'
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

export function ImageContextMenu({ children, onDelete }: Props): JSX.Element {
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

#### FolderContextMenu.tsx 수정

```diff
- import { FileText, FolderPlus, Palette, Pencil, Sheet, FileUp, Trash2 } from 'lucide-react'
+ import { FileText, FolderPlus, ImageIcon, Palette, Pencil, Sheet, FileUp, Trash2 } from 'lucide-react'

  interface Props {
    children: React.ReactNode
    onCreateChild: () => void
    onCreateNote: () => void
    onCreateCsv: () => void
    onImportPdf: () => void
+   onImportImage: () => void
    onRename: () => void
    onEditColor: () => void
    onDelete: () => void
  }

  // ContextMenuContent 내부, PDF 가져오기 다음:
+       <ContextMenuItem onClick={onImportImage}>
+         <ImageIcon className="size-4 mr-2" />
+         이미지 가져오기
+       </ContextMenuItem>
```

### 6.4 Image Viewer Widget

**디렉토리**: `src/renderer/src/widgets/image-viewer/`

> **라이브러리 설치**: `npm install react-zoom-pan-pinch`

#### ui/ImageViewer.tsx

```tsx
import { useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { IMAGE_EXTERNAL_CHANGED_EVENT } from '@entities/image-file'
import { ImageToolbar } from './ImageToolbar'

interface ImageViewerProps {
  imageId: string
  imageData: ArrayBuffer
  title: string
}

export function ImageViewer({ imageId, imageData, title }: ImageViewerProps): JSX.Element {
  const queryClient = useQueryClient()

  // ArrayBuffer → ObjectURL 변환
  const objectUrl = useMemo(() => {
    if (!imageData || imageData.byteLength === 0) return ''
    const blob = new Blob([imageData])
    return URL.createObjectURL(blob)
  }, [imageData])

  // 메모리 해제
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  // 외부 변경 이벤트 리스닝 → refetch (PdfViewer 패턴과 동일)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.imageId === imageId) {
        queryClient.invalidateQueries({ queryKey: ['image', 'content', imageId] })
      }
    }
    window.addEventListener(IMAGE_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(IMAGE_EXTERNAL_CHANGED_EVENT, handler)
  }, [imageId, queryClient])

  if (!objectUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        이미지를 불러올 수 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform, state }) => (
          <>
            <ImageToolbar
              scale={state.scale}
              onZoomIn={() => zoomIn()}
              onZoomOut={() => zoomOut()}
              onReset={() => resetTransform()}
            />
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', flex: 1, minHeight: 0 }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={objectUrl}
                alt={title}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                draggable={false}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
```

> **PDF와의 핵심 차이**:
> - PDF: `react-pdf` Document/Page + 다중 페이지 + 페이지 네비게이션
> - Image: `react-zoom-pan-pinch` TransformWrapper + 단일 `<img>` + ObjectURL
> - **공통**: 외부 변경 이벤트 리스닝은 Viewer 내부에서 처리 (PdfViewer/ImageViewer 모두 `useQueryClient`로 `invalidateQueries`)

#### ui/ImageToolbar.tsx

```tsx
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface ImageToolbarProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function ImageToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onReset
}: ImageToolbarProps): JSX.Element {
  return (
    <div className="flex items-center justify-center border-b px-3 py-1.5 bg-background gap-1">
      <Button variant="ghost" size="icon-sm" onClick={onZoomOut} disabled={scale <= 0.1}>
        <Minus className="size-4" />
      </Button>
      <span className="text-sm text-muted-foreground w-14 text-center">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon-sm" onClick={onZoomIn} disabled={scale >= 10}>
        <Plus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onReset}>
        <RotateCcw className="size-4" />
      </Button>
    </div>
  )
}
```

> **PDF Toolbar 대비 차이**: 페이지 네비게이션 섹션 없음 (이미지는 단일 페이지). 줌 컨트롤만 제공.

#### index.ts (위젯 배럴 export)

```typescript
export { ImageViewer } from './ui/ImageViewer'
```

### 6.5 Image Page

**디렉토리**: `src/renderer/src/pages/image/`

#### ui/ImagePage.tsx

PdfPage 패턴 복제: `setTabError`, 빈 ID 체크, `TabHeader isLoading` 스켈레톤, `FolderX` 에러 아이콘.

> **PdfPage와의 차이**: ImageViewer에 `title` prop이 필요하므로 `useImageFilesByWorkspace`를 추가로 호출하여 이미지 메타를 조회함. PdfViewer는 `title` prop이 없어 PdfPage에서 이 query가 불필요함.

```tsx
import { JSX, useEffect } from 'react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadImageContent } from '@entities/image-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { FolderX } from 'lucide-react'
import { ImageHeader } from '@/features/image/view-image'
import { ImageViewer } from '@widgets/image-viewer'

export function ImagePage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const imageId = params?.imageId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)

  const { data, isLoading, isError } = useReadImageContent(workspaceId, imageId)
  const { data: imageFiles } = useImageFilesByWorkspace(workspaceId)
  const image = imageFiles?.find((i) => i.id === imageId)

  // 에러 시 탭에 에러 상태 표시
  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

  // 외부 변경 이벤트는 ImageViewer 내부에서 처리 (PdfViewer 패턴과 동일)

  // 빈 ID 체크
  if (!imageId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">이미지 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }

  // 에러 상태
  if (isError) {
    return (
      <TabContainer header={null}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground mt-20">
          <FolderX className="size-12" />
          <p className="text-sm">이미지를 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      scrollable={false}
      maxWidth="full"
      header={<ImageHeader workspaceId={workspaceId} imageId={imageId} tabId={tabId} />}
    >
      <ImageViewer
        imageId={imageId}
        imageData={data?.data ?? new ArrayBuffer(0)}
        title={image?.title ?? ''}
      />
    </TabContainer>
  )
}
```

#### index.ts (배럴 export)

```typescript
export { ImagePage } from './ui/ImagePage'
export default ImagePage
```

### 6.6 Image Header (Feature)

**디렉토리**: `src/renderer/src/features/image/view-image/`

#### ui/ImageHeader.tsx

```tsx
import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { useRenameImageFile, useUpdateImageMeta, useImageFilesByWorkspace } from '@entities/image-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ImageIcon } from 'lucide-react'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'

interface ImageHeaderProps {
  workspaceId: string
  imageId: string
  tabId?: string
}

export function ImageHeader({ workspaceId, imageId, tabId }: ImageHeaderProps): JSX.Element {
  const { data: imageFiles } = useImageFilesByWorkspace(workspaceId)
  const image = imageFiles?.find((i) => i.id === imageId)
  const { mutate: renameImage } = useRenameImageFile()
  const { mutate: updateMeta } = useUpdateImageMeta()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  return (
    <TabHeader
      editable
      icon={ImageIcon}
      iconColor="#0ea5e9"
      title={image?.title ?? ''}
      description={image?.description ?? ''}
      buttons={
        <LinkedEntityPopoverButton entityType="image" entityId={imageId} workspaceId={workspaceId} />
      }
      onTitleChange={(title) => {
        renameImage({ workspaceId, imageId, newName: title })
        if (tabId) setTabTitle(tabId, title)
      }}
      onDescriptionChange={(desc) => {
        updateMeta({ workspaceId, imageId, data: { description: desc } })
      }}
    />
  )
}
```

> 아이콘 색상: `#0ea5e9` (sky-500, PDF의 `#ef4444` red-500, CSV의 `#10b981` emerald-500과 구분)

#### index.ts (배럴 export)

```typescript
export { ImageHeader } from './ui/ImageHeader'
```

---

## 7. Implementation Order

| # | Phase | 파일 수 | 설명 |
|---|-------|---------|------|
| 1 | 3.1 | 1 | DB 스키마 (`image-file.ts`) |
| 2 | 5A.1 | 1 | `schema/index.ts` — imageFiles export |
| 3 | — | 0 | `npm run db:generate` → `npm run db:migrate` |
| 4 | 3.2 | 1 | Repository (`image-file.ts`) |
| 5 | 5.2 | 1 | fs-utils 확장 (`IMAGE_EXTENSIONS`, `isImageFile`, 스캐너) |
| 6 | 5.1 | 1 | Leaf reindex 확장 (kind `'image'`) |
| 7 | 5.4 | 2 | Entity link 확장 (schema + service) |
| 8 | 3.3 | 1 | Service (`image-file.ts`) |
| 9 | 4.1 | 1 | IPC 핸들러 (`image-file.ts`) |
| 10 | 5A.2 | 1 | `main/index.ts` — registerImageFileHandlers |
| 11 | 5.3 | 1 | Workspace watcher 확장 |
| 12 | 5.5 | 2 | Preload bridge (타입 + 구현) |
| 13 | 6.2 | 3 | Tab system + routing + entity link renderer |
| 14 | 6.1 | 5 | Entity layer (types, own-write, queries, watcher, index) |
| 15 | 5A.3 | 1 | `MainLayout.tsx` — useImageWatcher |
| 16 | 6.3 | 7 | 폴더 트리 통합 (types, tree builder, FolderTree, FolderContextMenu, ImageNodeRenderer, ImageContextMenu) |
| 17 | 6.4 | 3 | Image 뷰어 위젯 (ImageViewer, ImageToolbar, index) |
| 18 | 6.5~6.6 | 4 | 페이지 (ImagePage + index) + Feature (ImageHeader + index) |

총 **~36개 파일** (신규 ~18, 수정 ~18)

> **사전 설치**: `npm install react-zoom-pan-pinch` (구현 시작 전 실행)

---

## 8. 테스트 계획

### 8.1 Unit Tests

| 대상 | 파일 | 주요 케이스 |
|------|------|-------------|
| Repository | `repositories/__tests__/image-file.test.ts` | CRUD, createMany, bulkDeleteByPrefix, bulkUpdatePathPrefix, reindexSiblings, deleteOrphans |
| Service | `services/__tests__/image-file.test.ts` | import (copyFileSync), rename (확장자 유지), remove (entity link 정리), readContent (Buffer), move (reindex kind='image'), readByWorkspace (orphan 삭제, 이동 감지), title 추출 동적 (7개 확장자) |
| buildWorkspaceTree | `features/folder/manage-folder/model/__tests__/use-workspace-tree.test.ts` | 기존 테스트에 imageFiles 파라미터 추가, Image 노드 정렬, 혼합 정렬 (note+csv+pdf+image) |

### 8.2 Manual Verification

1. 이미지 가져오기 (단일) → 폴더 트리에 표시, 탭 열기, 뷰어 렌더링
2. 이미지 다중 가져오기 → 모두 트리에 표시, 마지막 이미지만 탭 열기
3. 7개 확장자 모두 정상 표시 (png, jpg, jpeg, gif, webp, bmp, svg)
4. GIF 애니메이션 자동 재생 (`<img>` 태그 자동 지원)
5. 이미지 이름 변경 → disk 파일명 변경 (확장자 유지), 탭 제목 동기화
6. 이미지 삭제 → disk 삭제, 트리/탭 제거, entity link 정리
7. 이미지 폴더 이동 (DnD) → disk 이동, folderId/order 갱신
8. 줌 인/아웃 (마우스 휠 + 버튼)
9. 줌 리셋 (맞추기 버튼)
10. 드래그 팬
11. 외부 변경 → toast 표시, 뷰어 자동 새로고침 (objectUrl 갱신)
12. 폴더 삭제 시 하위 이미지 → DB에서 일괄 삭제, entity link 정리, changed 이벤트 발생
13. 폴더 이름 변경 → 이미지 relativePath 일괄 갱신
14. 동일 이름 이미지 가져오기 → resolveNameConflict 작동
15. 혼합 정렬 → 노트/CSV/PDF/Image siblings order 통합 관리
16. Entity link 연결/해제 정상 동작
17. Entity link에서 이미지 클릭 시 탭으로 열기
18. 앱 재시작 후 이미지 탭 복원
19. 탭 스냅샷 저장/복원 시 이미지 탭 포함
20. ObjectURL 메모리 해제 확인 (탭 닫기 시)

---

## 9. 주의사항

- **다중 확장자 처리**: PDF(`.pdf` 1개)와 달리 이미지는 7개 확장자를 모두 매칭해야 함. `isImageFile()` 헬퍼 함수를 `IMAGE_EXTENSIONS` 상수와 함께 `fs-utils.ts`에 정의하여 service, watcher 등에서 공용 사용
- **title 추출 5곳 전부 동적 변환 필수**: `path.basename(name, path.extname(name))` 사용. 서비스의 `readByWorkspace`(2곳), `import`(1곳), `rename`(1곳), `move`(1곳) + watcher의 title 추출에도 동일 적용
- **rename 시 확장자 유지**: `path.extname(image.relativePath)`로 원본 확장자 추출. PDF는 `'.pdf'` 하드코딩
- **move() kind**: `{ id: imageId, kind: 'image', order: 0 }` (PDF는 `kind: 'pdf'`). 누락 시 reindex가 잘못된 update statement로 실행됨
- **selectFile 반환 타입**: `string[]` (다중 선택). PDF는 `string` (단일 선택)
- **mutateAsync vs mutate**: Image import는 `mutateAsync` + for-of await (다중 파일 루프). PDF는 `mutate` + `onSuccess` 콜백
- **IPC Buffer 전달**: PDF와 동일하게 Electron structured clone이 Buffer → ArrayBuffer 자동 변환
- **ObjectURL 메모리 관리**: `URL.createObjectURL()` → 컴포넌트 언마운트 시 `URL.revokeObjectURL()` 해제 필수
- **SVG 파일**: 텍스트 기반이지만 일관성을 위해 바이너리로 처리
- **GIF 애니메이션**: `<img>` 태그가 자동 지원하므로 추가 처리 불필요
- **entity-link.ts 서비스**: `findEntity()` switch문에 `case 'image'` 반드시 추가 — 누락 시 런타임 에러
- **MainLayout.tsx**: `useImageWatcher()` 반드시 등록 — 누락 시 외부 이미지 변경이 UI에 반영되지 않음
- **to-tab-options.ts**: `case 'image'` 반드시 추가 — 누락 시 entity link 클릭 시 탭 열기 실패
- **Renderer entity-link.ts**: `ENTITY_TYPE_LABEL`과 `ENTITY_TYPE_ICON`에 'image' 추가 필요 (main/preload와 별개 파일)
- **FolderContextMenu.tsx**: `onImportImage` prop + 메뉴 항목 추가 필요
- **삭제 다이얼로그**: 별도 컴포넌트 불필요 — 기존 `DeleteFolderDialog` 재사용
- **탭 스냅샷/복원**: `TabType`을 명시적으로 직렬화하므로 추가 코드 불필요 (자동 지원)
- **아이콘 색상**: `ImageIcon` sky-500 (`#0ea5e9`) — PDF의 red-500 (`#ef4444`), CSV의 emerald-500 (`#10b981`)과 시각적 구분
- **watcher Step 14 entity link 정리**: standalone delete 시 `entityLinkRepository.removeAllByEntity('image', id)` 호출 필수 — PDF Step 11과 동일 패턴

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-03-02 | Initial draft — PDF design 패턴 복제 + Image 전용 차이점 반영 |
