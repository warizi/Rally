import type { Router } from '../router'
import { csvFileService } from '../../services/csv-file'
import { csvFileRepository } from '../../repositories/csv-file'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerCsvRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/tables
  router.addRoute('GET', '/api/workspaces/:wsId/tables', (params) => {
    const tables = csvFileService.readByWorkspaceFromDb(params.wsId)
    const folders = folderRepository.findByWorkspaceId(params.wsId)
    const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

    return {
      tables: tables.map((t) => ({
        id: t.id,
        title: t.title,
        relativePath: t.relativePath,
        description: t.description,
        preview: t.preview,
        folderId: t.folderId,
        folderPath: t.folderId ? (folderMap.get(t.folderId) ?? null) : null,
        updatedAt: t.updatedAt.toISOString()
      }))
    }
  })

  // GET /api/workspaces/:wsId/tables/:tableId/content
  router.addRoute('GET', '/api/workspaces/:wsId/tables/:tableId/content', (params) => {
    const csv = csvFileRepository.findById(params.tableId)
    if (!csv) throw new NotFoundError(`Table not found: ${params.tableId}`)

    const { content, encoding } = csvFileService.readContent(params.wsId, params.tableId)
    return {
      title: csv.title,
      relativePath: csv.relativePath,
      content,
      encoding
    }
  })

  // PUT /api/workspaces/:wsId/tables/:tableId/content
  router.addRoute<{ content: string }>(
    'PUT',
    '/api/workspaces/:wsId/tables/:tableId/content',
    (params, body) => {
      requireBody(body)
      const csv = csvFileRepository.findById(params.tableId)
      if (!csv) throw new NotFoundError(`Table not found: ${params.tableId}`)

      csvFileService.writeContent(params.wsId, params.tableId, body.content)

      broadcastChanged('csv:changed', params.wsId, [csv.relativePath])

      return {
        success: true,
        title: csv.title,
        relativePath: csv.relativePath
      }
    }
  )

  // POST /api/workspaces/:wsId/tables
  router.addRoute<{ title: string; folderId?: string; content?: string }>(
    'POST',
    '/api/workspaces/:wsId/tables',
    (params, body) => {
      requireBody(body)
      const folderId = body.folderId ?? null
      const result = csvFileService.create(params.wsId, folderId, body.title)

      try {
        if (body.content) {
          csvFileService.writeContent(params.wsId, result.id, body.content)
        }
      } finally {
        broadcastChanged('csv:changed', params.wsId, [result.relativePath])
      }

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath
      }
    }
  )

  // PATCH /api/workspaces/:wsId/tables/:tableId/rename
  router.addRoute<{ newName: string }>(
    'PATCH',
    '/api/workspaces/:wsId/tables/:tableId/rename',
    (params, body) => {
      requireBody(body)
      const oldCsv = csvFileRepository.findById(params.tableId)
      if (!oldCsv) throw new NotFoundError(`Table not found: ${params.tableId}`)

      const result = csvFileService.rename(params.wsId, params.tableId, body.newName)

      broadcastChanged('csv:changed', params.wsId, [oldCsv.relativePath, result.relativePath])

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath
      }
    }
  )

  // DELETE /api/workspaces/:wsId/tables/:tableId
  router.addRoute('DELETE', '/api/workspaces/:wsId/tables/:tableId', (params) => {
    const csv = csvFileRepository.findById(params.tableId)
    if (!csv) throw new NotFoundError(`Table not found: ${params.tableId}`)

    csvFileService.remove(params.wsId, params.tableId)

    broadcastChanged('csv:changed', params.wsId, [csv.relativePath])

    return { success: true }
  })

  // PATCH /api/workspaces/:wsId/tables/:tableId/move
  router.addRoute<{ targetFolderId?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/tables/:tableId/move',
    (params, body) => {
      requireBody(body)
      const oldCsv = csvFileRepository.findById(params.tableId)
      if (!oldCsv) throw new NotFoundError(`Table not found: ${params.tableId}`)

      const targetFolderId = body.targetFolderId ?? null
      const result = csvFileService.move(params.wsId, params.tableId, targetFolderId, 0)

      broadcastChanged('csv:changed', params.wsId, [oldCsv.relativePath, result.relativePath])

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath,
        folderId: result.folderId
      }
    }
  )
}
