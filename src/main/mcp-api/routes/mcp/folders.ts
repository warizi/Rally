import type { Router } from '../../router'
import type { ManageFolderResult, FolderAction } from './types'
import { folderRepository } from '../../../repositories/folder'
import { folderService } from '../../../services/folder'
import { NotFoundError, ValidationError } from '../../../lib/errors'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace } from './helpers'

export function registerMcpFolderRoutes(router: Router): void {
  // ─── POST /api/mcp/folders/batch → manage_folders ─────────

  router.addRoute<{ actions: FolderAction[] }>(
    'POST',
    '/api/mcp/folders/batch',
    (_, body): { results: ManageFolderResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      if (!Array.isArray(body.actions) || body.actions.length === 0)
        throw new ValidationError('actions array is required')

      const results: ManageFolderResult[] = []
      const affectedPaths: string[] = []
      let hasFolderChange = false

      for (const [i, action] of body.actions.entries()) {
        try {
          if (action.action === 'create') {
            const result = folderService.create(wsId, action.parentFolderId ?? null, action.name)
            affectedPaths.push(result.relativePath)
            results.push({ action: 'create', id: result.id, success: true })
          } else if (action.action === 'rename') {
            const result = folderService.rename(wsId, action.folderId, action.newName)
            affectedPaths.push(result.relativePath)
            hasFolderChange = true
            results.push({ action: 'rename', id: action.folderId, success: true })
          } else if (action.action === 'move') {
            const result = folderService.move(
              wsId,
              action.folderId,
              action.parentFolderId ?? null,
              0
            )
            affectedPaths.push(result.relativePath)
            hasFolderChange = true
            results.push({ action: 'move', id: action.folderId, success: true })
          } else if (action.action === 'delete') {
            const folder = folderRepository.findById(action.folderId)
            if (!folder) throw new NotFoundError(`Folder not found: ${action.folderId}`)
            affectedPaths.push(folder.relativePath)
            folderService.remove(wsId, action.folderId)
            hasFolderChange = true
            results.push({ action: 'delete', id: action.folderId, success: true })
          }
        } catch (e) {
          throw new ValidationError((e as Error).message, {
            failedActionIndex: i,
            completedCount: results.length
          })
        }
      }

      broadcastChanged('folder:changed', wsId, affectedPaths)
      if (hasFolderChange) {
        broadcastChanged('note:changed', wsId, [])
        broadcastChanged('csv:changed', wsId, [])
      }

      return { results }
    }
  )
}
