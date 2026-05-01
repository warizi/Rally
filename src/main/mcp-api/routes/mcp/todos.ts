import type { Router } from '../../router'
import type { TodoNode, ManageTodoResult, TodoAction } from './types'
import { todoService } from '../../../services/todo'
import { todoRepository } from '../../../repositories/todo'
import { entityLinkService } from '../../../services/entity-link'
import type { LinkableEntityType } from '../../../db/schema/entity-link'
import { ValidationError } from '../../../lib/errors'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

const VALID_LINK_TYPES: ReadonlySet<LinkableEntityType> = new Set([
  'note',
  'csv',
  'canvas',
  'todo',
  'pdf',
  'image',
  'schedule'
])

const VALID_PRIORITIES: ReadonlySet<'high' | 'medium' | 'low'> = new Set(['high', 'medium', 'low'])

function parsePriorityParam(query: URLSearchParams): ('high' | 'medium' | 'low')[] | undefined {
  const csv = query.get('priority')
  const repeat = query.getAll('priority[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const p of cleaned) {
    if (!VALID_PRIORITIES.has(p as 'high' | 'medium' | 'low')) {
      throw new ValidationError(`Invalid priority: ${p}. Must be one of high, medium, low.`)
    }
  }
  return cleaned as ('high' | 'medium' | 'low')[]
}

export function registerMcpTodoRoutes(router: Router): void {
  // ─── GET /api/mcp/todos → list_todos ──────────────────────

  router.addRoute('GET', '/api/mcp/todos', (_params, _body, query): { todos: TodoNode[] } => {
    const wsId = resolveActiveWorkspace()
    const filter = (query.get('filter') as 'all' | 'active' | 'completed') || 'active'
    const resolveLinks = query.get('resolveLinks') === 'true'

    // ── 추가 필터 파싱 ───────────────────────────────────────
    const parentIdRaw = query.get('parentId')
    let parentId: string | null | undefined
    if (parentIdRaw === null) parentId = undefined
    else if (parentIdRaw === 'null' || parentIdRaw === '') parentId = null
    else {
      assertValidId(parentIdRaw, 'parentId')
      parentId = parentIdRaw
    }

    const linkedToType = query.get('linkedTo[type]') ?? query.get('linkedToType')
    const linkedToId = query.get('linkedTo[id]') ?? query.get('linkedToId')
    let linkedTo: { type: LinkableEntityType; id: string } | undefined
    if (linkedToType || linkedToId) {
      if (!linkedToType || !linkedToId) {
        throw new ValidationError('linkedTo requires both type and id')
      }
      if (!VALID_LINK_TYPES.has(linkedToType as LinkableEntityType)) {
        throw new ValidationError(`Invalid linkedTo type: ${linkedToType}`)
      }
      assertValidId(linkedToId, 'linkedTo[id]')
      linkedTo = { type: linkedToType as LinkableEntityType, id: linkedToId }
    }

    const dueWithinRaw = query.get('dueWithin')
    let dueWithin: number | undefined
    if (dueWithinRaw !== null && dueWithinRaw !== '') {
      const n = Number.parseInt(dueWithinRaw, 10)
      if (!Number.isFinite(n) || n < 0 || `${n}` !== dueWithinRaw) {
        throw new ValidationError('dueWithin must be a non-negative integer (days)')
      }
      dueWithin = n
    }

    const priority = parsePriorityParam(query)
    const search = query.get('search') ?? undefined

    const useFilters =
      parentId !== undefined ||
      linkedTo !== undefined ||
      dueWithin !== undefined ||
      priority !== undefined ||
      (search !== undefined && search.trim().length > 0)

    const todos = useFilters
      ? todoService.findByWorkspaceFiltered(wsId, {
          filter,
          parentId,
          linkedTo,
          dueWithin,
          priority,
          search
        })
      : todoService.findByWorkspace(wsId, filter)

    // N+1 회피: 모든 todo의 링크를 단일 batch 호출로 수집
    // (link rows 1 query + type별 title 6 query 이내 → 100개 todo여도 ~7 쿼리)
    // resolveLinks=true면 type별 preview/description을 추가 batch fetch (+최대 6 쿼리)
    const todoIds = todos.map((t) => t.id)
    const linksMap = resolveLinks
      ? entityLinkService.getLinkedBatchWithPreview('todo', todoIds)
      : entityLinkService.getLinkedBatch('todo', todoIds)

    function mapTodo(t: (typeof todos)[number]): TodoNode {
      const linked = linksMap.get(t.id) ?? []
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
          title: l.title,
          preview: 'preview' in l ? ((l as { preview: string | null }).preview ?? null) : null
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
      } else {
        // parent가 결과셋에 없거나 root → 결과 root에 포함.
        // parentId 단독 호출(부모 자체는 결과셋에 없음) / search·priority 등 부분 매칭에서
        // 자식만 매칭됐을 때도 누락되지 않도록 함.
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

      const results = processBatchActions<TodoAction, ManageTodoResult>(body.actions, (action) => {
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
              assertValidId(item.id, `linkItems[].id (${item.type})`)
              entityLinkService.link(item.type, item.id, 'todo', result.id, wsId)
            }
          }
          return { action: 'create', id: result.id, success: true }
        }
        if (action.action === 'update') {
          assertValidId(action.id, 'todo id')
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
                `Cannot link/unlink on a subtodo (parentId=${todo.parentId}). ` +
                  `Subtodos do not support links — link the parent todo, ` +
                  `or convert this subtodo to a top-level todo first.`
              )
            }
            if (action.linkItems?.length) {
              for (const item of action.linkItems) {
                assertValidId(item.id, `linkItems[].id (${item.type})`)
                entityLinkService.link(item.type, item.id, 'todo', action.id, wsId)
              }
            }
            if (action.unlinkItems?.length) {
              for (const item of action.unlinkItems) {
                assertValidId(item.id, `unlinkItems[].id (${item.type})`)
                entityLinkService.unlink(item.type, item.id, 'todo', action.id, wsId)
              }
            }
          }
          return { action: 'update', id: action.id, success: true }
        }
        // delete
        assertValidId(action.id, 'todo id')
        todoService.remove(action.id)
        return { action: 'delete', id: action.id, success: true }
      })

      // broadcast는 트랜잭션 외부에서 — rollback 불가능한 부수효과
      broadcastChanged('todo:changed', wsId, [])
      return { results }
    }
  )
}
