import type { Router } from '../router'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { folderService } from '../../services/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerFolderRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/folders
  router.addRoute('GET', '/api/workspaces/:wsId/folders', (params) => {
    const workspace = workspaceRepository.findById(params.wsId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${params.wsId}`)

    const folders = folderRepository.findByWorkspaceId(params.wsId)
    return {
      folders: folders.map((f) => ({
        id: f.id,
        relativePath: f.relativePath,
        order: f.order
      }))
    }
  })

  // POST /api/workspaces/:wsId/folders
  router.addRoute<{ parentFolderId?: string; name: string }>(
    'POST',
    '/api/workspaces/:wsId/folders',
    (params, body) => {
      requireBody(body)
      const parentFolderId = body.parentFolderId ?? null
      const result = folderService.create(params.wsId, parentFolderId, body.name)

      broadcastChanged('folder:changed', params.wsId, [result.relativePath])

      return {
        id: result.id,
        name: result.name,
        relativePath: result.relativePath
      }
    }
  )

  // PATCH /api/workspaces/:wsId/folders/:folderId/rename
  router.addRoute<{ newName: string }>(
    'PATCH',
    '/api/workspaces/:wsId/folders/:folderId/rename',
    (params, body) => {
      requireBody(body)
      const result = folderService.rename(params.wsId, params.folderId, body.newName)

      broadcastChanged('folder:changed', params.wsId, [result.relativePath])
      broadcastChanged('note:changed', params.wsId, [])
      broadcastChanged('csv:changed', params.wsId, [])

      return {
        id: result.id,
        name: result.name,
        relativePath: result.relativePath
      }
    }
  )

  // DELETE /api/workspaces/:wsId/folders/:folderId
  router.addRoute('DELETE', '/api/workspaces/:wsId/folders/:folderId', (params) => {
    const folder = folderRepository.findById(params.folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${params.folderId}`)

    folderService.remove(params.wsId, params.folderId)

    broadcastChanged('folder:changed', params.wsId, [folder.relativePath])
    broadcastChanged('note:changed', params.wsId, [])
    broadcastChanged('csv:changed', params.wsId, [])

    return { success: true }
  })

  // PATCH /api/workspaces/:wsId/folders/:folderId/move
  router.addRoute<{ parentFolderId?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/folders/:folderId/move',
    (params, body) => {
      requireBody(body)
      const parentFolderId = body.parentFolderId ?? null
      const result = folderService.move(params.wsId, params.folderId, parentFolderId, 0)

      broadcastChanged('folder:changed', params.wsId, [result.relativePath])
      broadcastChanged('note:changed', params.wsId, [])
      broadcastChanged('csv:changed', params.wsId, [])

      return {
        id: result.id,
        name: result.name,
        relativePath: result.relativePath
      }
    }
  )
}
