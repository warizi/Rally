import type { Router } from '../router'
import { workspaceWatcher } from '../../services/workspace-watcher'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { folderService } from '../../services/folder'
import { noteService } from '../../services/note'
import { csvFileService } from '../../services/csv-file'
import { canvasService } from '../../services/canvas'
import { canvasNodeService } from '../../services/canvas-node'
import { canvasEdgeService } from '../../services/canvas-edge'
import { todoService } from '../../services/todo'
import { todoRepository } from '../../repositories/todo'
import { entityLinkService } from '../../services/entity-link'
import { ValidationError, NotFoundError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerMcpRoutes(router: Router): void {
  function resolveActiveWorkspace(): string {
    const wsId = workspaceWatcher.getActiveWorkspaceId()
    if (!wsId)
      throw new ValidationError(
        '활성 워크스페이스가 없습니다. Rally에서 워크스페이스를 열어주세요.'
      )
    const ws = workspaceRepository.findById(wsId)
    if (!ws) throw new ValidationError('활성 워크스페이스를 찾을 수 없습니다.')
    return wsId
  }

  function resolveItemType(id: string): { type: 'note' | 'table'; row: any } {
    const note = noteRepository.findById(id)
    if (note) return { type: 'note', row: note }
    const csv = csvFileRepository.findById(id)
    if (csv) return { type: 'table', row: csv }
    throw new NotFoundError(`Item not found: ${id}`)
  }

  // ─── GET /api/mcp/items → list_items ───────────────────────

  router.addRoute('GET', '/api/mcp/items', () => {
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
        folderPath: n.folderId ? folderMap.get(n.folderId) ?? null : null,
        updatedAt: n.updatedAt.toISOString()
      })),
      tables: tables.map((t) => ({
        id: t.id,
        title: t.title,
        relativePath: t.relativePath,
        description: t.description,
        preview: t.preview,
        folderId: t.folderId,
        folderPath: t.folderId ? folderMap.get(t.folderId) ?? null : null,
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

  // ─── GET /api/mcp/notes/search → search_notes ─────────────

  router.addRoute('GET', '/api/mcp/notes/search', async (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const q = query.get('q') || ''
    if (!q.trim()) return { results: [] }
    const results = await noteService.search(wsId, q)
    return { results }
  })

  // ─── GET /api/mcp/content/:id → read_content ──────────────

  router.addRoute('GET', '/api/mcp/content/:id', (params) => {
    const wsId = resolveActiveWorkspace()
    const { type, row } = resolveItemType(params.id)

    if (type === 'note') {
      const content = noteService.readContent(wsId, params.id)
      return { type: 'note', title: row.title, relativePath: row.relativePath, content }
    } else {
      const { content, encoding, columnWidths } = csvFileService.readContent(wsId, params.id)
      return {
        type: 'table',
        title: row.title,
        relativePath: row.relativePath,
        content,
        encoding,
        columnWidths
      }
    }
  })

  // ─── POST /api/mcp/content → write_content ────────────────

  router.addRoute<{
    type?: 'note' | 'table'
    id?: string
    title?: string
    folderId?: string
    content: string
  }>('POST', '/api/mcp/content', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()

    if (body.id) {
      const { type, row } = resolveItemType(body.id)
      if (type === 'note') {
        noteService.writeContent(wsId, body.id, body.content)
        broadcastChanged('note:changed', wsId, [row.relativePath])
      } else {
        csvFileService.writeContent(wsId, body.id, body.content)
        broadcastChanged('csv:changed', wsId, [row.relativePath])
      }
      const updated =
        type === 'note' ? noteRepository.findById(body.id) : csvFileRepository.findById(body.id)
      return {
        type,
        id: body.id,
        title: updated!.title,
        relativePath: updated!.relativePath,
        created: false
      }
    } else {
      if (!body.type) throw new ValidationError('type is required for create')
      if (!body.title) throw new ValidationError('title is required for create')
      const folderId = body.folderId ?? null

      if (body.type === 'note') {
        const result = noteService.create(wsId, folderId, body.title)
        if (body.content) noteService.writeContent(wsId, result.id, body.content)
        broadcastChanged('note:changed', wsId, [result.relativePath])
        return {
          type: 'note',
          id: result.id,
          title: result.title,
          relativePath: result.relativePath,
          created: true
        }
      } else {
        const result = csvFileService.create(wsId, folderId, body.title)
        if (body.content) csvFileService.writeContent(wsId, result.id, body.content)
        broadcastChanged('csv:changed', wsId, [result.relativePath])
        return {
          type: 'table',
          id: result.id,
          title: result.title,
          relativePath: result.relativePath,
          created: true
        }
      }
    }
  })

  // ─── POST /api/mcp/items/batch → manage_items ─────────────

  router.addRoute<{ actions: any[] }>('POST', '/api/mcp/items/batch', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    if (!Array.isArray(body.actions) || body.actions.length === 0)
      throw new ValidationError('actions array is required')

    const resolved = body.actions.map((a: any, i: number) => {
      try {
        return { ...a, ...resolveItemType(a.id) }
      } catch (e) {
        throw new ValidationError((e as Error).message, { failedActionIndex: i })
      }
    })

    const results: any[] = []
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
  })

  // ─── POST /api/mcp/folders/batch → manage_folders ─────────

  router.addRoute<{ actions: any[] }>('POST', '/api/mcp/folders/batch', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    if (!Array.isArray(body.actions) || body.actions.length === 0)
      throw new ValidationError('actions array is required')

    const results: any[] = []
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
  })

  // ─── GET /api/mcp/canvases/:canvasId → read_canvas ────────

  router.addRoute('GET', '/api/mcp/canvases/:canvasId', (params) => {
    resolveActiveWorkspace()
    const canvas = canvasService.findById(params.canvasId)
    const nodes = canvasNodeService.findByCanvas(params.canvasId)
    const edges = canvasEdgeService.findByCanvas(params.canvasId)
    return {
      canvas: {
        id: canvas.id,
        title: canvas.title,
        description: canvas.description,
        createdAt: canvas.createdAt.toISOString(),
        updatedAt: canvas.updatedAt.toISOString()
      },
      nodes,
      edges
    }
  })

  // ─── POST /api/mcp/canvases → create_canvas ───────────────

  router.addRoute<{
    title: string
    description?: string
    nodes?: any[]
    edges?: any[]
  }>('POST', '/api/mcp/canvases', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()

    if (body.edges?.length && !body.nodes?.length)
      throw new ValidationError('edges require nodes to reference')

    const canvas = canvasService.create(wsId, {
      title: body.title,
      description: body.description
    })

    const createdNodes: { index: number; id: string; [key: string]: any }[] = []

    if (body.nodes?.length) {
      for (const [index, node] of body.nodes.entries()) {
        const result = canvasNodeService.create(canvas.id, {
          type: node.type,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          content: node.content,
          refId: node.refId,
          color: node.color
        })
        createdNodes.push({ index, id: result.id, type: result.type, x: result.x, y: result.y })
      }
    }

    const createdEdges: any[] = []

    if (body.edges?.length) {
      for (const edge of body.edges) {
        const fromNode = createdNodes[edge.fromNodeIndex]?.id
        const toNode = createdNodes[edge.toNodeIndex]?.id
        if (!fromNode) throw new ValidationError(`Invalid fromNodeIndex: ${edge.fromNodeIndex}`)
        if (!toNode) throw new ValidationError(`Invalid toNodeIndex: ${edge.toNodeIndex}`)

        const result = canvasEdgeService.create(canvas.id, {
          fromNode,
          toNode,
          fromSide: edge.fromSide,
          toSide: edge.toSide,
          label: edge.label,
          color: edge.color,
          style: edge.style,
          arrow: edge.arrow
        })
        createdEdges.push(result)
      }
    }

    broadcastChanged('canvas:changed', wsId, [])

    return {
      canvas: { id: canvas.id, title: canvas.title, description: canvas.description },
      nodes: createdNodes,
      edges: createdEdges
    }
  })

  // ─── POST /api/mcp/canvases/:canvasId/edit → edit_canvas ──

  router.addRoute<{ actions: any[] }>(
    'POST',
    '/api/mcp/canvases/:canvasId/edit',
    (params, body) => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      if (!Array.isArray(body.actions) || body.actions.length === 0)
        throw new ValidationError('actions array is required')
      const actions = body.actions

      const hasDelete = actions.some((a: any) => a.action === 'delete')
      if (hasDelete && actions.length > 1)
        throw new ValidationError('delete action must be used alone')

      if (hasDelete) {
        canvasService.remove(params.canvasId)
        broadcastChanged('canvas:changed', wsId, [])
        return { results: [{ action: 'delete', success: true }] }
      }

      const tempIdMap = new Map<string, string>()
      const results: any[] = []

      for (const action of actions) {
        if (action.action === 'update') {
          canvasService.update(params.canvasId, {
            title: action.title,
            description: action.description
          })
          results.push({ action: 'update', success: true })
        } else if (action.action === 'add_node') {
          const result = canvasNodeService.create(params.canvasId, {
            type: action.type,
            x: action.x,
            y: action.y,
            width: action.width,
            height: action.height,
            content: action.content,
            refId: action.refId,
            color: action.color
          })
          if (action.tempId) tempIdMap.set(action.tempId, result.id)
          results.push({
            action: 'add_node',
            tempId: action.tempId || undefined,
            id: result.id
          })
        } else if (action.action === 'remove_node') {
          canvasNodeService.remove(action.nodeId)
          results.push({ action: 'remove_node', nodeId: action.nodeId, success: true })
        } else if (action.action === 'add_edge') {
          const fromNode = tempIdMap.get(action.fromNode) ?? action.fromNode
          const toNode = tempIdMap.get(action.toNode) ?? action.toNode
          const result = canvasEdgeService.create(params.canvasId, {
            fromNode,
            toNode,
            fromSide: action.fromSide,
            toSide: action.toSide,
            label: action.label,
            color: action.color,
            style: action.style,
            arrow: action.arrow
          })
          results.push({ action: 'add_edge', id: result.id })
        } else if (action.action === 'remove_edge') {
          canvasEdgeService.remove(action.edgeId)
          results.push({ action: 'remove_edge', edgeId: action.edgeId, success: true })
        }
      }

      broadcastChanged('canvas:changed', wsId, [])
      return { results }
    }
  )

  // ─── GET /api/mcp/todos → list_todos ──────────────────────

  router.addRoute('GET', '/api/mcp/todos', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const filter = (query.get('filter') as 'all' | 'active' | 'completed') || 'all'
    const todos = todoService.findByWorkspace(wsId, filter)

    function mapTodo(t: (typeof todos)[number]) {
      const linked = entityLinkService.getLinked('todo', t.id)
      return {
        id: t.id,
        parentId: t.parentId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        isDone: t.isDone,
        dueDate: t.dueDate?.toISOString() ?? null,
        startDate: t.startDate?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        linkedItems: linked.map((l) => ({
          type: l.entityType,
          id: l.entityId,
          title: l.title
        })),
        children: [] as ReturnType<typeof mapTodo>[]
      }
    }

    const mapped = todos.map(mapTodo)
    const byId = new Map(mapped.map((t) => [t.id, t]))
    const roots: ReturnType<typeof mapTodo>[] = []

    for (const todo of mapped) {
      if (todo.parentId && byId.has(todo.parentId)) {
        byId.get(todo.parentId)!.children.push(todo)
      } else if (!todo.parentId) {
        roots.push(todo)
      }
    }

    return { todos: roots }
  })

  // ─── POST /api/mcp/todos/batch → manage_todos ─────────────

  router.addRoute<{ actions: any[] }>('POST', '/api/mcp/todos/batch', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    if (!Array.isArray(body.actions) || body.actions.length === 0)
      throw new ValidationError('actions array is required')

    const results: any[] = []

    for (const [i, action] of body.actions.entries()) {
      try {
        if (action.action === 'create') {
          const result = todoService.create(wsId, {
            title: action.title,
            description: action.description,
            status: action.status,
            priority: action.priority,
            parentId: action.parentId,
            dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
            startDate: action.startDate ? new Date(action.startDate) : undefined
          })
          if (action.linkItems?.length) {
            if (result.parentId) {
              throw new ValidationError('Cannot link items to a subtodo. Only top-level todos support linkedItems.')
            }
            for (const item of action.linkItems) {
              entityLinkService.link(item.type, item.id, 'todo', result.id, wsId)
            }
          }
          results.push({ action: 'create', id: result.id, success: true })
        } else if (action.action === 'update') {
          todoService.update(action.id, {
            title: action.title,
            description: action.description,
            status: action.status,
            priority: action.priority,
            isDone: action.isDone,
            dueDate:
              action.dueDate === null ? null : action.dueDate ? new Date(action.dueDate) : undefined,
            startDate:
              action.startDate === null
                ? null
                : action.startDate
                  ? new Date(action.startDate)
                  : undefined
          })
          if (action.linkItems?.length || action.unlinkItems?.length) {
            const todo = todoRepository.findById(action.id)
            if (todo?.parentId) {
              throw new ValidationError('Cannot link/unlink items on a subtodo. Only top-level todos support linkedItems.')
            }
            if (action.linkItems?.length) {
              for (const item of action.linkItems) {
                entityLinkService.link(item.type, item.id, 'todo', action.id, wsId)
              }
            }
            if (action.unlinkItems?.length) {
              for (const item of action.unlinkItems) {
                entityLinkService.unlink(item.type, item.id, 'todo', action.id)
              }
            }
          }
          results.push({ action: 'update', id: action.id, success: true })
        } else if (action.action === 'delete') {
          todoService.remove(action.id)
          results.push({ action: 'delete', id: action.id, success: true })
        }
      } catch (e) {
        throw new ValidationError((e as Error).message, {
          failedActionIndex: i,
          completedCount: results.length
        })
      }
    }

    broadcastChanged('todo:changed', wsId, [])
    return { results }
  })
}
