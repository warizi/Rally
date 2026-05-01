import type { Router } from '../../router'
import type { ManageFolderResult, FolderAction } from './types'
import { folderRepository } from '../../../repositories/folder'
import { folderService } from '../../../services/folder'
import { NotFoundError, ValidationError } from '../../../lib/errors'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

/**
 * 폴더 batch는 FS+DB 혼합 작업이라 진정한 트랜잭션 롤백이 어려움.
 * 차선책: 실행 전 모든 액션의 ID 존재성을 read-only로 검증해 잘못된 입력으로 인한 부분 commit을 방지.
 * race condition(검증 후 다른 클라이언트가 폴더 삭제 등)은 여전히 가능하지만 흔한 케이스(invalid id, 자기 자신을 부모로)는 잡힘.
 */
function preflightFolderActions(actions: FolderAction[], workspaceId: string): void {
  const tentativeIds = new Set<string>()

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const ctx = `actions[${i}]`

    if (action.action === 'create') {
      if (action.parentFolderId) {
        assertValidId(action.parentFolderId, `${ctx}.parentFolderId`)
        if (!tentativeIds.has(action.parentFolderId)) {
          const parent = folderRepository.findById(action.parentFolderId)
          if (!parent || parent.workspaceId !== workspaceId) {
            throw new NotFoundError(`Folder not found: ${action.parentFolderId}`)
          }
        }
      }
      // create는 이전 batch 액션이 부여한 ID를 알 수 없으므로 미리 등록 불가
      // (parentFolderId가 같은 batch의 create 결과를 참조하는 경우는 미지원)
    } else if (action.action === 'rename') {
      assertValidId(action.folderId, `${ctx}.folderId`)
      const folder = folderRepository.findById(action.folderId)
      if (!folder || folder.workspaceId !== workspaceId) {
        throw new NotFoundError(`Folder not found: ${action.folderId}`)
      }
      tentativeIds.add(action.folderId)
    } else if (action.action === 'move') {
      assertValidId(action.folderId, `${ctx}.folderId`)
      const folder = folderRepository.findById(action.folderId)
      if (!folder || folder.workspaceId !== workspaceId) {
        throw new NotFoundError(`Folder not found: ${action.folderId}`)
      }
      if (action.parentFolderId) {
        assertValidId(action.parentFolderId, `${ctx}.parentFolderId`)
        if (action.parentFolderId === action.folderId) {
          throw new ValidationError(`${ctx}: cannot move folder into itself`)
        }
        const parent = folderRepository.findById(action.parentFolderId)
        if (!parent || parent.workspaceId !== workspaceId) {
          throw new NotFoundError(`Folder not found: ${action.parentFolderId}`)
        }
      }
      tentativeIds.add(action.folderId)
    } else {
      // delete
      assertValidId(action.folderId, `${ctx}.folderId`)
      const folder = folderRepository.findById(action.folderId)
      if (!folder || folder.workspaceId !== workspaceId) {
        throw new NotFoundError(`Folder not found: ${action.folderId}`)
      }
      tentativeIds.add(action.folderId)
    }
  }
}

export function registerMcpFolderRoutes(router: Router): void {
  // ─── POST /api/mcp/folders/batch → manage_folders ─────────

  router.addRoute<{ actions: FolderAction[] }>(
    'POST',
    '/api/mcp/folders/batch',
    (_, body): { results: ManageFolderResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      // 1. 사전 validation — invalid id 등 흔한 fail 케이스를 실행 전에 거름 (부분 commit 방지)
      preflightFolderActions(body.actions, wsId)

      const affectedPaths: string[] = []
      let hasFolderChange = false

      // 2. FS + DB 혼합 작업이라 transactional: false (DB만 트랜잭션 묶어도 FS와 어긋남).
      //    실제 실행 단계에서 race로 fail이 나면 부분 commit 가능성 잔존 — 향후 service 레벨에서 atomic 보장을 추가하는 별도 작업 필요.
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
