import type { Router } from '../../router'
import { ValidationError, NotFoundError } from '../../../lib/errors'
import { reminderService } from '../../../services/reminder'
import { reminderRepository } from '../../../repositories/reminder'
import { todoRepository } from '../../../repositories/todo'
import { scheduleRepository } from '../../../repositories/schedule'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'
import type { ReminderAction, ManageReminderResult, ReminderSummary } from './types'

const VALID_ENTITY_TYPES = new Set(['todo', 'schedule'])

function ownedByWs(entityType: 'todo' | 'schedule', entityId: string, wsId: string): void {
  if (entityType === 'todo') {
    const todo = todoRepository.findById(entityId)
    if (!todo || todo.workspaceId !== wsId) {
      throw new NotFoundError(`Todo not found in active workspace: ${entityId}`)
    }
  } else {
    const sch = scheduleRepository.findById(entityId)
    if (!sch || sch.workspaceId !== wsId) {
      throw new NotFoundError(`Schedule not found in active workspace: ${entityId}`)
    }
  }
}

function toSummary(r: ReturnType<typeof reminderService.findByEntity>[number]): ReminderSummary {
  return {
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    offsetMs: r.offsetMs,
    remindAt: r.remindAt.toISOString(),
    isFired: r.isFired,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  }
}

export function registerMcpReminderRoutes(router: Router): void {
  // ─── GET /api/mcp/reminders → list_reminders ──────────────
  // entityType+entityId가 주어지면 해당 entity의 알림만, 아니면 활성 ws의 모든 알림.

  router.addRoute('GET', '/api/mcp/reminders', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const entityType = query.get('entityType') as 'todo' | 'schedule' | null
    const entityId = query.get('entityId')
    const pendingOnly = query.get('pendingOnly') === 'true'

    let items: ReturnType<typeof reminderService.findByEntity> = []

    if (entityType && entityId) {
      if (!VALID_ENTITY_TYPES.has(entityType)) {
        throw new ValidationError(`Invalid entityType: ${entityType}`)
      }
      assertValidId(entityId, 'entityId')
      ownedByWs(entityType, entityId, wsId)
      items = reminderService.findByEntity(entityType, entityId)
    } else {
      // 워크스페이스 단위 조회: todo + schedule 둘 다 합산
      const todos = todoRepository.findByWorkspaceWithFilters(wsId, { filter: 'all' })
      const schedules = scheduleRepository.findAllByWorkspaceId(wsId)
      const collected: ReturnType<typeof reminderService.findByEntity> = []
      for (const t of todos) collected.push(...reminderService.findByEntity('todo', t.id))
      for (const s of schedules) collected.push(...reminderService.findByEntity('schedule', s.id))
      items = collected
    }

    if (pendingOnly) items = items.filter((r) => !r.isFired)
    return { reminders: items.map(toSummary) }
  })

  // ─── POST /api/mcp/reminders/batch → manage_reminders ─────
  // create / delete 만 지원 (set은 entity+offsetMs unique 제약상 update와 동일).

  router.addRoute<{ actions: ReminderAction[] }>(
    'POST',
    '/api/mcp/reminders/batch',
    (_, body): { results: ManageReminderResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const results = processBatchActions<ReminderAction, ManageReminderResult>(
        body.actions,
        (action) => {
          if (action.action === 'create') {
            if (!VALID_ENTITY_TYPES.has(action.entityType)) {
              throw new ValidationError(`Invalid entityType: ${action.entityType}`)
            }
            assertValidId(action.entityId, 'entityId')
            ownedByWs(action.entityType, action.entityId, wsId)
            const reminder = reminderService.set({
              entityType: action.entityType,
              entityId: action.entityId,
              offsetMs: action.offsetMs
            })
            return { action: 'create', id: reminder.id, success: true }
          }
          // delete
          assertValidId(action.id, 'reminder id')
          const reminder = reminderRepository.findById(action.id)
          if (!reminder) throw new NotFoundError(`Reminder not found: ${action.id}`)
          // 소유권: reminder.entityType+entityId가 활성 ws에 속하는지
          ownedByWs(reminder.entityType as 'todo' | 'schedule', reminder.entityId, wsId)
          reminderService.remove(action.id)
          return { action: 'delete', id: action.id, success: true }
        },
        { transactional: true }
      )

      broadcastChanged('reminder:changed', wsId, [])
      return { results }
    }
  )
}
