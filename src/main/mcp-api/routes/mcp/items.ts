import type { Router } from '../../router'
import type { ListItemsResponse, ManageItemResult, ItemAction } from './types'
import { workspaceRepository } from '../../../repositories/workspace'
import { folderRepository } from '../../../repositories/folder'
import { noteService } from '../../../services/note'
import { csvFileService } from '../../../services/csv-file'
import { canvasService } from '../../../services/canvas'
import { todoService } from '../../../services/todo'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, resolveItemType, assertValidId } from './helpers'

export function registerMcpItemRoutes(router: Router): void {
  // ─── GET /api/mcp/items → list_items ───────────────────────

  router.addRoute('GET', '/api/mcp/items', (): ListItemsResponse => {
    const wsId = resolveActiveWorkspace()
    const workspace = workspaceRepository.findById(wsId)!

    const folders = folderRepository.findByWorkspaceId(wsId)
    const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

    const notes = noteService.readByWorkspaceFromDb(wsId)
    const tables = csvFileService.readByWorkspaceFromDb(wsId)
    const canvases = canvasService.findByWorkspace(wsId)
    // 풀 fetch 대신 SQL COUNT — 큰 워크스페이스에서 메모리/시간 절약
    const todoCounts = todoService.countByWorkspace(wsId)

    return {
      workspace: { id: workspace.id, name: workspace.name, path: workspace.path },
      folders: folders.map((f) => ({ id: f.id, relativePath: f.relativePath, order: f.order })),
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        relativePath: n.relativePath,
        preview: n.preview,
        folderId: n.folderId,
        folderPath: n.folderId ? (folderMap.get(n.folderId) ?? null) : null,
        updatedAt: n.updatedAt.toISOString()
      })),
      tables: tables.map((t) => ({
        id: t.id,
        title: t.title,
        relativePath: t.relativePath,
        description: t.description,
        preview: t.preview,
        folderId: t.folderId,
        folderPath: t.folderId ? (folderMap.get(t.folderId) ?? null) : null,
        updatedAt: t.updatedAt.toISOString()
      })),
      canvases: canvases.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      })),
      todos: todoCounts
    }
  })

  // ─── POST /api/mcp/items/batch → manage_items ─────────────

  router.addRoute<{ actions: ItemAction[] }>(
    'POST',
    '/api/mcp/items/batch',
    (_, body): { results: ManageItemResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const noteAffected: string[] = []
      const tableAffected: string[] = []

      // FS + DB 혼합 작업이라 transactional: false (DB만 트랜잭션 묶어도 FS와 어긋남).
      // 향후 service 레벨에서 atomic 보장을 추가하는 별도 작업 필요.
      const results = processBatchActions<ItemAction, ManageItemResult>(
        body.actions,
        (action) => {
          assertValidId(action.id, 'item id')
          if (action.action === 'move' && action.targetFolderId) {
            assertValidId(action.targetFolderId, 'targetFolderId')
          }
          const resolved = resolveItemType(action.id)

          if (action.action === 'rename') {
            if (resolved.type === 'note') {
              const old = resolved.row.relativePath
              const result = noteService.rename(wsId, action.id, action.newName)
              noteAffected.push(old, result.relativePath)
            } else {
              const old = resolved.row.relativePath
              const result = csvFileService.rename(wsId, action.id, action.newName)
              tableAffected.push(old, result.relativePath)
            }
          } else if (action.action === 'move') {
            if (resolved.type === 'note') {
              const old = resolved.row.relativePath
              const result = noteService.move(wsId, action.id, action.targetFolderId ?? null, 0)
              noteAffected.push(old, result.relativePath)
            } else {
              const old = resolved.row.relativePath
              const result = csvFileService.move(wsId, action.id, action.targetFolderId ?? null, 0)
              tableAffected.push(old, result.relativePath)
            }
          } else {
            // delete
            if (resolved.type === 'note') {
              noteAffected.push(resolved.row.relativePath)
              noteService.remove(wsId, action.id)
            } else {
              tableAffected.push(resolved.row.relativePath)
              csvFileService.remove(wsId, action.id)
            }
          }
          return { action: action.action, type: resolved.type, id: action.id, success: true }
        },
        { transactional: false }
      )

      if (noteAffected.length > 0) broadcastChanged('note:changed', wsId, noteAffected)
      if (tableAffected.length > 0) broadcastChanged('csv:changed', wsId, tableAffected)

      return { results }
    }
  )
}
