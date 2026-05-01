import type { Router } from '../../router'
import { ValidationError, NotFoundError } from '../../../lib/errors'
import { scheduleService } from '../../../services/schedule'
import { scheduleRepository } from '../../../repositories/schedule'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'
import type { ScheduleAction, ManageScheduleResult, ScheduleSummary } from './types'

function parseIso(raw: string | null, label: string): Date | undefined {
  if (raw === null || raw === '') return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date`)
  }
  return d
}

function requireIso(raw: unknown, label: string): Date {
  if (typeof raw !== 'string' || !raw) {
    throw new ValidationError(`${label} is required`)
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date`)
  }
  return d
}

function toSummary(item: ReturnType<typeof scheduleService.findById>): ScheduleSummary {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    title: item.title,
    description: item.description,
    location: item.location,
    allDay: item.allDay,
    startAt: item.startAt.toISOString(),
    endAt: item.endAt.toISOString(),
    color: item.color,
    priority: item.priority,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  }
}

export function registerMcpScheduleRoutes(router: Router): void {
  // ─── GET /api/mcp/schedules → list_schedules ──────────────

  router.addRoute('GET', '/api/mcp/schedules', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const from = parseIso(query.get('from'), 'from')
    const to = parseIso(query.get('to'), 'to')
    const search = (query.get('search') ?? '').trim().toLowerCase()

    let items =
      from && to
        ? scheduleService.findByWorkspace(wsId, { start: from, end: to })
        : scheduleService.findAllByWorkspace(wsId)

    if (search) {
      items = items.filter(
        (s) =>
          s.title.toLowerCase().includes(search) ||
          (s.description ?? '').toLowerCase().includes(search) ||
          (s.location ?? '').toLowerCase().includes(search)
      )
    }

    return { schedules: items.map(toSummary) }
  })

  // ─── POST /api/mcp/schedules/batch → manage_schedules ─────

  router.addRoute<{ actions: ScheduleAction[] }>(
    'POST',
    '/api/mcp/schedules/batch',
    (_, body): { results: ManageScheduleResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const results = processBatchActions<ScheduleAction, ManageScheduleResult>(
        body.actions,
        (action) => {
          if (action.action === 'create') {
            const startAt = requireIso(action.startAt, 'startAt')
            const endAt = requireIso(action.endAt, 'endAt')
            const created = scheduleService.create(wsId, {
              title: action.title,
              description: action.description ?? null,
              location: action.location ?? null,
              allDay: action.allDay,
              startAt,
              endAt,
              color: action.color ?? null,
              priority: action.priority
            })
            return { action: 'create', id: created.id, success: true }
          }
          if (action.action === 'update') {
            assertValidId(action.id, 'schedule id')
            const existing = scheduleRepository.findById(action.id)
            // schedule의 workspaceId는 nullable이라 별도 검증
            if (!existing || existing.workspaceId !== wsId) {
              throw new NotFoundError(`Schedule not found: ${action.id}`)
            }
            scheduleService.update(action.id, {
              title: action.title,
              description: action.description,
              location: action.location,
              allDay: action.allDay,
              startAt: action.startAt ? new Date(action.startAt) : undefined,
              endAt: action.endAt ? new Date(action.endAt) : undefined,
              color: action.color,
              priority: action.priority
            })
            return { action: 'update', id: action.id, success: true }
          }
          // delete
          assertValidId(action.id, 'schedule id')
          const existing = scheduleRepository.findById(action.id)
          if (!existing || existing.workspaceId !== wsId) {
            throw new NotFoundError(`Schedule not found: ${action.id}`)
          }
          scheduleService.remove(action.id)
          return { action: 'delete', id: action.id, success: true }
        },
        // FS 미관여 — 트랜잭션 가능 (DB-only)
        { transactional: true }
      )

      broadcastChanged('schedule:changed', wsId, [])
      return { results }
    }
  )
}
