import type { Router } from '../../router'
import type { ManageFolderResult, FolderAction } from './types'
import { folderRepository } from '../../../repositories/folder'
import { folderService } from '../../../services/folder'
import { NotFoundError } from '../../../lib/errors'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

export function registerMcpFolderRoutes(router: Router): void {
  // ─── POST /api/mcp/folders/batch → manage_folders ─────────

  router.addRoute<{ actions: FolderAction[] }>(
    'POST',
    '/api/mcp/folders/batch',
    (_, body): { results: ManageFolderResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const affectedPaths: string[] = []
      let hasFolderChange = false

      // FS + DB 혼합 작업이라 transactional: false (DB만 트랜잭션 묶어도 FS와 어긋남).
      // 향후 service 레벨에서 atomic 보장을 추가하는 별도 작업 필요.
      const results = processBatchActions<FolderAction, ManageFolderResult>(
        body.actions,
        (action) => {
          if (action.action === 'create') {
            if (action.parentFolderId) assertValidId(action.parentFolderId, 'parentFolderId')
            const result = folderService.create(wsId, action.parentFolderId ?? null, action.name)
            affectedPaths.push(result.relativePath)
            return { action: 'create', id: result.id, success: true }
          }
          if (action.action === 'rename') {
            assertValidId(action.folderId, 'folderId')
            const result = folderService.rename(wsId, action.folderId, action.newName)
            affectedPaths.push(result.relativePath)
            hasFolderChange = true
            return { action: 'rename', id: action.folderId, success: true }
          }
          if (action.action === 'move') {
            assertValidId(action.folderId, 'folderId')
            if (action.parentFolderId) assertValidId(action.parentFolderId, 'parentFolderId')
            const result = folderService.move(
              wsId,
              action.folderId,
              action.parentFolderId ?? null,
              0
            )
            affectedPaths.push(result.relativePath)
            hasFolderChange = true
            return { action: 'move', id: action.folderId, success: true }
          }
          // delete
          assertValidId(action.folderId, 'folderId')
          const folder = folderRepository.findById(action.folderId)
          if (!folder) throw new NotFoundError(`Folder not found: ${action.folderId}`)
          affectedPaths.push(folder.relativePath)
          folderService.remove(wsId, action.folderId)
          hasFolderChange = true
          return { action: 'delete', id: action.folderId, success: true }
        },
        { transactional: false }
      )

      broadcastChanged('folder:changed', wsId, affectedPaths)
      if (hasFolderChange) {
        broadcastChanged('note:changed', wsId, [])
        broadcastChanged('csv:changed', wsId, [])
      }

      return { results }
    }
  )
}
