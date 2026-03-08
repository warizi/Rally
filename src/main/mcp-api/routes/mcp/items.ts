import type { Router } from '../../router'
import type { ListItemsResponse, ManageItemResult, ItemAction } from './types'
import { workspaceRepository } from '../../../repositories/workspace'
import { folderRepository } from '../../../repositories/folder'
import { noteService } from '../../../services/note'
import { csvFileService } from '../../../services/csv-file'
import { canvasService } from '../../../services/canvas'
import { todoService } from '../../../services/todo'
import { ValidationError } from '../../../lib/errors'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, resolveItemType } from './helpers'

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
    const allTodos = todoService.findByWorkspace(wsId)

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
      todos: {
        active: allTodos.filter((t) => !t.isDone).length,
        completed: allTodos.filter((t) => t.isDone).length,
        total: allTodos.length
      }
    }
  })

  // ─── POST /api/mcp/items/batch → manage_items ─────────────

  router.addRoute<{ actions: ItemAction[] }>(
    'POST',
    '/api/mcp/items/batch',
    (_, body): { results: ManageItemResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      if (!Array.isArray(body.actions) || body.actions.length === 0)
        throw new ValidationError('actions array is required')

      const resolved = body.actions.map((a, i) => {
        try {
          return { ...a, ...resolveItemType(a.id) }
        } catch (e) {
          throw new ValidationError((e as Error).message, { failedActionIndex: i })
        }
      })

      const results: ManageItemResult[] = []
      const noteAffected: string[] = []
      const tableAffected: string[] = []

      for (const [i, action] of resolved.entries()) {
        try {
          if (action.action === 'rename') {
            if (action.type === 'note') {
              const old = action.row.relativePath
              const result = noteService.rename(wsId, action.id, action.newName)
              noteAffected.push(old, result.relativePath)
            } else {
              const old = action.row.relativePath
              const result = csvFileService.rename(wsId, action.id, action.newName)
              tableAffected.push(old, result.relativePath)
            }
          } else if (action.action === 'move') {
            if (action.type === 'note') {
              const old = action.row.relativePath
              const result = noteService.move(wsId, action.id, action.targetFolderId ?? null, 0)
              noteAffected.push(old, result.relativePath)
            } else {
              const old = action.row.relativePath
              const result = csvFileService.move(wsId, action.id, action.targetFolderId ?? null, 0)
              tableAffected.push(old, result.relativePath)
            }
          } else if (action.action === 'delete') {
            if (action.type === 'note') {
              noteAffected.push(action.row.relativePath)
              noteService.remove(wsId, action.id)
            } else {
              tableAffected.push(action.row.relativePath)
              csvFileService.remove(wsId, action.id)
            }
          }
          results.push({ action: action.action, type: action.type, id: action.id, success: true })
        } catch (e) {
          throw new ValidationError((e as Error).message, {
            failedActionIndex: i,
            completedCount: results.length
          })
        }
      }

      if (noteAffected.length > 0) broadcastChanged('note:changed', wsId, noteAffected)
      if (tableAffected.length > 0) broadcastChanged('csv:changed', wsId, tableAffected)

      return { results }
    }
  )
}
