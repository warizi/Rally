import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { pdfFileRepository } from '../repositories/pdf-file'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readPdfFilesRecursive } from '../lib/fs-utils'
import { normalizePath, parentRelPath } from '../lib/path-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'
import { cleanupOrphansAndDelete } from '../lib/orphan-cleanup'

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
    const allFolders = folderRepository.findByWorkspaceId(workspaceId)
    const folderMap = new Map(allFolders.map((f) => [f.relativePath, f]))
    const toInsert: Parameters<typeof pdfFileRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? (folderMap.get(parentRel) ?? null) : null
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
    const dbRowsAfterUpsert = pdfFileRepository.findByWorkspaceId(workspaceId)
    const orphanIds = dbRowsAfterUpsert
      .filter((r) => !fsPathSet.has(r.relativePath))
      .map((r) => r.id)
    cleanupOrphansAndDelete('pdf', orphanIds, () =>
      pdfFileRepository.deleteOrphans(workspaceId, fsPaths)
    )

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

  /** 같은 폴더에 "name (n).pdf"로 복사 + DB 등록 */
  duplicate(workspaceId: string, pdfId: string): PdfFileNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    const folderRel = parentRelPath(pdf.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    const sourceFileName = path.basename(pdf.relativePath)
    const finalFileName = resolveNameConflict(parentAbs, sourceFileName)
    const title = finalFileName.replace(/\.pdf$/, '')

    const sourceAbs = path.join(workspace.path, pdf.relativePath)
    const destAbs = path.join(parentAbs, finalFileName)
    const destRel = normalizePath(folderRel ? `${folderRel}/${finalFileName}` : finalFileName)

    fs.copyFileSync(sourceAbs, destAbs)

    const now = new Date()
    const newId = nanoid()

    pdfFileRepository.create({
      id: newId,
      workspaceId,
      folderId: pdf.folderId,
      relativePath: destRel,
      title,
      description: '',
      preview: '',
      order: 0,
      createdAt: now,
      updatedAt: now
    })

    // 원본 바로 아래에 위치하도록 siblings reindex
    const siblings = getLeafSiblings(workspaceId, pdf.folderId).filter((s) => s.id !== newId)
    const sourceIndex = siblings.findIndex((s) => s.id === pdfId)
    const insertAt = sourceIndex >= 0 ? sourceIndex + 1 : siblings.length
    siblings.splice(insertAt, 0, { id: newId, kind: 'pdf', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      siblings.map((s) => ({ id: s.id, kind: s.kind }))
    )

    return toPdfFileNode(pdfFileRepository.findById(newId)!)
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
    cleanupOrphansAndDelete('pdf', [pdfId], () => pdfFileRepository.delete(pdfId))
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
  updateMeta(_workspaceId: string, pdfId: string, data: { description?: string }): PdfFileNode {
    const pdf = pdfFileRepository.findById(pdfId)
    if (!pdf) throw new NotFoundError(`PDF not found: ${pdfId}`)

    const updated = pdfFileRepository.update(pdfId, {
      ...data,
      updatedAt: new Date()
    })!

    return toPdfFileNode(updated)
  }
}
