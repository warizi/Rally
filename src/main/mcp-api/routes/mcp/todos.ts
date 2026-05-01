import type { Router } from '../../router'
import type { TodoNode, ManageTodoResult, TodoAction } from './types'
import { todoService } from '../../../services/todo'
import { todoRepository } from '../../../repositories/todo'
import { entityLinkService } from '../../../services/entity-link'
import { ValidationError } from '../../../lib/errors'
import { withTransaction } from '../../../lib/transaction'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace } from './helpers'

export function registerMcpTodoRoutes(router: Router): void {
  // ─── GET /api/mcp/todos → list_todos ──────────────────────

  router.addRoute('GET', '/api/mcp/todos', (_params, _body, query): { todos: TodoNode[] } => {
    const wsId = resolveActiveWorkspace()
    const filter = (query.get('filter') as 'all' | 'active' | 'completed') || 'active'
    const todos = todoService.findByWorkspace(wsId, filter)

    function mapTodo(t: (typeof todos)[number]): TodoNode {
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
        children: []
      }
    }

    const mapped = todos.map(mapTodo)
    const byId = new Map(mapped.map((t) => [t.id, t]))
    const roots: TodoNode[] = []

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

  router.addRoute<{ actions: TodoAction[] }>(
    'POST',
    '/api/mcp/todos/batch',
    (_, body): { results: ManageTodoResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      if (!Array.isArray(body.actions) || body.actions.length === 0)
        throw new ValidationError('actions array is required')

      // 모든 액션을 단일 트랜잭션으로 처리 — 어느 하나 실패 시 전체 rollback (DB only).
      // todo / entity_link는 모두 DB 작업이므로 FS 부수효과 없음 → 안전하게 트랜잭션 가능.
      const results = withTransaction((): ManageTodoResult[] => {
        const acc: ManageTodoResult[] = []
        for (const [i, action] of body.actions.entries()) {
          try {
            if (action.action === 'create') {
              const result = todoService.create(wsId, {
                title: action.title,
                description: action.description,
                status: action.status,
                priority: action.priority,
                dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
                startDate: action.startDate ? new Date(action.startDate) : undefined
              })
              if (action.subtodos?.length) {
                for (const sub of action.subtodos) {
                  todoService.create(wsId, { title: sub.title, parentId: result.id })
                }
              }
              if (action.linkItems?.length) {
                for (const item of action.linkItems) {
                  entityLinkService.link(item.type, item.id, 'todo', result.id, wsId)
                }
              }
              acc.push({ action: 'create', id: result.id, success: true })
            } else if (action.action === 'update') {
              todoService.update(action.id, {
                title: action.title,
                description: action.description,
                status: action.status,
                priority: action.priority,
                isDone: action.isDone,
                dueDate:
                  action.dueDate === null
                    ? null
                    : action.dueDate
                      ? new Date(action.dueDate)
                      : undefined,
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
                  throw new ValidationError(
                    'Cannot link/unlink items on a subtodo. Only top-level todos support linkedItems.'
                  )
                }
                if (action.linkItems?.length) {
                  for (const item of action.linkItems) {
                    entityLinkService.link(item.type, item.id, 'todo', action.id, wsId)
                  }
                }
                if (action.unlinkItems?.length) {
                  for (const item of action.unlinkItems) {
                    entityLinkService.unlink(item.type, item.id, 'todo', action.id, wsId)
                  }
                }
              }
              acc.push({ action: 'update', id: action.id, success: true })
            } else if (action.action === 'delete') {
              todoService.remove(action.id)
              acc.push({ action: 'delete', id: action.id, success: true })
            }
          } catch (e) {
            throw new ValidationError((e as Error).message, {
              failedActionIndex: i,
              completedCount: acc.length
            })
          }
        }
        return acc
      })

      // broadcast는 트랜잭션 외부에서 — rollback 불가능한 부수효과
      broadcastChanged('todo:changed', wsId, [])
      return { results }
    }
  )
}
