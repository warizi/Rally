import type { Router } from '../../router'
import { ValidationError } from '../../../lib/errors'
import { pdfFileService } from '../../../services/pdf-file'
import { pdfFileRepository } from '../../../repositories/pdf-file'
import { imageFileService } from '../../../services/image-file'
import { imageFileRepository } from '../../../repositories/image-file'
import { folderRepository } from '../../../repositories/folder'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import {
  requireBody,
  resolveActiveWorkspace,
  assertOwnedByWorkspace,
  assertValidId
} from './helpers'
import type { FileAction, ManageFileResult, FileSummary } from './types'

interface FileRow {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}

function toSummary(row: FileRow): FileSummary {
  const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
  const updated = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)
  return {
    id: row.id,
    title: row.title,
    relativePath: row.relativePath,
    description: row.description,
    preview: row.preview,
    folderId: row.folderId,
    order: row.order,
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString()
  }
}

function listFiles(
  rows: FileRow[],
  options: {
    folderId: string | null | undefined
    folderIds: Set<string> | null
    search: string
  }
): FileSummary[] {
  let filtered = rows
  if (options.folderId === null) {
    filtered = filtered.filter((r) => r.folderId === null)
  } else if (options.folderIds) {
    filtered = filtered.filter((r) => r.folderId !== null && options.folderIds!.has(r.folderId))
  }
  if (options.search) {
    const lower = options.search.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) || (r.description ?? '').toLowerCase().includes(lower)
    )
  }
  return filtered.map(toSummary)
}

function resolveFolderScope(
  wsId: string,
  query: URLSearchParams
): { folderId: string | null | undefined; folderIds: Set<string> | null } {
  const raw = query.get('folderId')
  if (raw === null || raw === '') return { folderId: undefined, folderIds: null }
  if (raw === 'null') return { folderId: null, folderIds: null }
  assertValidId(raw, 'folderId')
  const recursive = query.get('recursive') === 'true'
  const allFolders = folderRepository.findByWorkspaceId(wsId)
  const target = allFolders.find((f) => f.id === raw)
  if (!target) {
    throw new ValidationError(`Folder not found: ${raw}`)
  }
  if (!recursive) {
    return { folderId: undefined, folderIds: new Set([target.id]) }
  }
  const set = new Set<string>([target.id])
  for (const f of allFolders) {
    if (f.relativePath.startsWith(`${target.relativePath}/`)) set.add(f.id)
  }
  return { folderId: undefined, folderIds: set }
}

export function registerMcpFileRoutes(router: Router): void {
  // ─── PDFs ──────────────────────────────────────────────────

  router.addRoute('GET', '/api/mcp/pdfs', (_p, _b, query) => {
    const wsId = resolveActiveWorkspace()
    const scope = resolveFolderScope(wsId, query)
    const search = (query.get('search') ?? '').trim()
    const rows = pdfFileService.readByWorkspaceFromDb(wsId)
    return { pdfs: listFiles(rows, { ...scope, search }) }
  })

  router.addRoute<{ actions: FileAction[] }>(
    'POST',
    '/api/mcp/pdfs/batch',
    (_, body): { results: ManageFileResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      const affected: string[] = []

      const results = processBatchActions<FileAction, ManageFileResult>(
        body.actions,
        (action) => {
          assertValidId(action.id, 'pdf id')
          const existing = pdfFileRepository.findById(action.id)
          assertOwnedByWorkspace(existing, wsId, `PDF not found: ${action.id}`)

          if (action.action === 'rename') {
            const old = existing.relativePath
            const result = pdfFileService.rename(wsId, action.id, action.newName)
            affected.push(old, result.relativePath)
            return { action: 'rename', id: action.id, success: true }
          }
          if (action.action === 'move') {
            if (action.targetFolderId) assertValidId(action.targetFolderId, 'targetFolderId')
            const old = existing.relativePath
            const result = pdfFileService.move(wsId, action.id, action.targetFolderId ?? null, 0)
            affected.push(old, result.relativePath)
            return { action: 'move', id: action.id, success: true }
          }
          if (action.action === 'update_meta') {
            pdfFileService.updateMeta(wsId, action.id, { description: action.description })
            return { action: 'update_meta', id: action.id, success: true }
          }
          // delete
          affected.push(existing.relativePath)
          pdfFileService.remove(wsId, action.id)
          return { action: 'delete', id: action.id, success: true }
        },
        // FS+DB 혼합
        { transactional: false }
      )

      if (affected.length > 0) broadcastChanged('pdf:changed', wsId, affected)
      return { results }
    }
  )

  // ─── Images ────────────────────────────────────────────────

  router.addRoute('GET', '/api/mcp/images', (_p, _b, query) => {
    const wsId = resolveActiveWorkspace()
    const scope = resolveFolderScope(wsId, query)
    const search = (query.get('search') ?? '').trim()
    const rows = imageFileService.readByWorkspaceFromDb(wsId)
    return { images: listFiles(rows, { ...scope, search }) }
  })

  router.addRoute<{ actions: FileAction[] }>(
    'POST',
    '/api/mcp/images/batch',
    (_, body): { results: ManageFileResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      const affected: string[] = []

      const results = processBatchActions<FileAction, ManageFileResult>(
        body.actions,
        (action) => {
          assertValidId(action.id, 'image id')
          const existing = imageFileRepository.findById(action.id)
          assertOwnedByWorkspace(existing, wsId, `Image not found: ${action.id}`)

          if (action.action === 'rename') {
            const old = existing.relativePath
            const result = imageFileService.rename(wsId, action.id, action.newName)
            affected.push(old, result.relativePath)
            return { action: 'rename', id: action.id, success: true }
          }
          if (action.action === 'move') {
            if (action.targetFolderId) assertValidId(action.targetFolderId, 'targetFolderId')
            const old = existing.relativePath
            const result = imageFileService.move(wsId, action.id, action.targetFolderId ?? null, 0)
            affected.push(old, result.relativePath)
            return { action: 'move', id: action.id, success: true }
          }
          if (action.action === 'update_meta') {
            imageFileService.updateMeta(wsId, action.id, { description: action.description })
            return { action: 'update_meta', id: action.id, success: true }
          }
          // delete
          affected.push(existing.relativePath)
          imageFileService.remove(wsId, action.id)
          return { action: 'delete', id: action.id, success: true }
        },
        { transactional: false }
      )

      if (affected.length > 0) broadcastChanged('image:changed', wsId, affected)
      return { results }
    }
  )
}
