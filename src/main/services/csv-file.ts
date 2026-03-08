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
import { normalizePath, parentRelPath } from '../lib/path-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'
import { cleanupOrphansAndDelete } from '../lib/orphan-cleanup'

export interface CsvFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  columnWidths: string | null
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

function toCsvFileNode(row: {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  columnWidths: string | null
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
    columnWidths: row.columnWidths,
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
    const allFolders = folderRepository.findByWorkspaceId(workspaceId)
    const folderMap = new Map(allFolders.map((f) => [f.relativePath, f]))
    const toInsert: Parameters<typeof csvFileRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? (folderMap.get(parentRel) ?? null) : null
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
    const dbRowsAfterUpsert = csvFileRepository.findByWorkspaceId(workspaceId)
    const orphanIds = dbRowsAfterUpsert
      .filter((r) => !fsPathSet.has(r.relativePath))
      .map((r) => r.id)
    cleanupOrphansAndDelete('csv', orphanIds, () =>
      csvFileRepository.deleteOrphans(workspaceId, fsPaths)
    )

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

    const desiredFileName = (name.trim() || '새로운 테이블') + '.csv'
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
    cleanupOrphansAndDelete('csv', [csvId], () => csvFileRepository.delete(csvId))
  },

  /**
   * CSV 내용 읽기 (인코딩 자동 감지)
   */
  readContent(
    workspaceId: string,
    csvId: string
  ): { content: string; encoding: string; columnWidths: string | null } {
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
      return { content: '', encoding: 'UTF-8', columnWidths: csv.columnWidths }
    }

    const detected = chardet.detect(rawBuffer)
    const encoding = detected ?? 'UTF-8'

    let content = iconv.decode(rawBuffer, encoding)
    // BOM 제거
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1)
    }

    return { content, encoding, columnWidths: csv.columnWidths }
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
  updateMeta(
    _workspaceId: string,
    csvId: string,
    data: { description?: string; columnWidths?: string }
  ): CsvFileNode {
    const csv = csvFileRepository.findById(csvId)
    if (!csv) throw new NotFoundError(`CSV not found: ${csvId}`)

    const updated = csvFileRepository.update(csvId, {
      ...data,
      updatedAt: new Date()
    })!

    return toCsvFileNode(updated)
  }
}
