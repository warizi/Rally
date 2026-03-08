import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { imageFileRepository } from '../repositories/image-file'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readImageFilesRecursive } from '../lib/fs-utils'
import { normalizePath, parentRelPath } from '../lib/path-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'
import { cleanupOrphansAndDelete } from '../lib/orphan-cleanup'

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

    const orphanByBasename = new Map<string, (typeof orphanedRows)[0]>()
    for (const orphan of orphanedRows) {
      const basename = path.basename(orphan.relativePath)
      if (!orphanByBasename.has(basename)) orphanByBasename.set(basename, orphan)
    }

    const now = new Date()
    const allFolders = folderRepository.findByWorkspaceId(workspaceId)
    const folderMap = new Map(allFolders.map((f) => [f.relativePath, f]))
    const toInsert: Parameters<typeof imageFileRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? (folderMap.get(parentRel) ?? null) : null
      if (matchedOrphan) {
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
    const dbRowsAfterUpsert = imageFileRepository.findByWorkspaceId(workspaceId)
    const orphanIds = dbRowsAfterUpsert
      .filter((r) => !fsPathSet.has(r.relativePath))
      .map((r) => r.id)
    cleanupOrphansAndDelete('image', orphanIds, () =>
      imageFileRepository.deleteOrphans(workspaceId, fsPaths)
    )

    return imageFileRepository.findByWorkspaceId(workspaceId).map(toImageFileNode)
  },

  readByWorkspaceFromDb(workspaceId: string): ImageFileNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return imageFileRepository.findByWorkspaceId(workspaceId).map(toImageFileNode)
  },

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

  rename(workspaceId: string, imageId: string, newName: string): ImageFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    if (newName.trim() === image.title) return toImageFileNode(image)

    const folderRel = parentRelPath(image.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    const ext = path.extname(image.relativePath)
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
    cleanupOrphansAndDelete('image', [imageId], () => imageFileRepository.delete(imageId))
  },

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

    const siblings = getLeafSiblings(workspaceId, targetFolderId)
    const withoutSelf = siblings.filter((s) => s.id !== imageId)
    withoutSelf.splice(index, 0, { id: imageId, kind: 'image', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      withoutSelf.map((s) => ({ id: s.id, kind: s.kind }))
    )

    const updated = imageFileRepository.findById(imageId)!
    return toImageFileNode(updated)
  },

  updateMeta(_workspaceId: string, imageId: string, data: { description?: string }): ImageFileNode {
    const image = imageFileRepository.findById(imageId)
    if (!image) throw new NotFoundError(`Image not found: ${imageId}`)

    const updated = imageFileRepository.update(imageId, {
      ...data,
      updatedAt: new Date()
    })!

    return toImageFileNode(updated)
  }
}
