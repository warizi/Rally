import type { Router } from '../../router'
import { ValidationError, NotFoundError } from '../../../lib/errors'
import { recurringRuleService } from '../../../services/recurring-rule'
import { recurringRuleRepository } from '../../../repositories/recurring-rule'
import { recurringCompletionService } from '../../../services/recurring-completion'
import { recurringCompletionRepository } from '../../../repositories/recurring-completion'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import {
  requireBody,
  resolveActiveWorkspace,
  assertOwnedByWorkspace,
  assertValidId
} from './helpers'
import type {
  RecurringRuleAction,
  ManageRecurringRuleResult,
  RecurringRuleSummary,
  RecurringCompletionSummary
} from './types'

function parseDate(raw: string | null | undefined, label: string): Date | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date`)
  }
  return d
}

function requireDate(raw: unknown, label: string): Date {
  if (typeof raw !== 'string' || !raw) {
    throw new ValidationError(`${label} is required`)
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date`)
  }
  return d
}

function toRuleSummary(
  item: ReturnType<typeof recurringRuleService.findByWorkspace>[number]
): RecurringRuleSummary {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    title: item.title,
    description: item.description,
    priority: item.priority,
    recurrenceType: item.recurrenceType,
    daysOfWeek: item.daysOfWeek,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate?.toISOString() ?? null,
    startTime: item.startTime,
    endTime: item.endTime,
    reminderOffsetMs: item.reminderOffsetMs,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  }
}

function toCompletionSummary(
  item: ReturnType<typeof recurringCompletionService.findByWorkspace>[number]
): RecurringCompletionSummary {
  return {
    id: item.id,
    ruleId: item.ruleId,
    ruleTitle: item.ruleTitle,
    workspaceId: item.workspaceId,
    completedDate: item.completedDate,
    completedAt: item.completedAt.toISOString(),
    createdAt: item.createdAt.toISOString()
  }
}

export function registerMcpRecurringRoutes(router: Router): void {
  // ─── GET /api/mcp/recurring/rules → list_recurring_rules ──

  router.addRoute('GET', '/api/mcp/recurring/rules', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const activeOnly = query.get('activeOnly') === 'true'
    let rules = recurringRuleService.findByWorkspace(wsId)
    if (activeOnly) {
      const now = new Date()
      rules = rules.filter((r) => r.endDate === null || r.endDate >= now)
    }
    return { rules: rules.map(toRuleSummary) }
  })

  // ─── GET /api/mcp/recurring/today → list_recurring_today ──
  // ?date=YYYY-MM-DD (default: 오늘)

  router.addRoute('GET', '/api/mcp/recurring/today', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const dateRaw = query.get('date')
    let date: Date
    if (dateRaw) {
      // YYYY-MM-DD 또는 ISO datetime 둘 다 허용
      const d = new Date(dateRaw)
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError('date must be YYYY-MM-DD or ISO 8601')
      }
      date = d
    } else {
      date = new Date()
    }
    const rules = recurringRuleService.findTodayRules(wsId, date)
    const completions = recurringCompletionService.findTodayByWorkspace(wsId, date)
    const completedRuleIds = new Set(completions.map((c) => c.ruleId).filter(Boolean) as string[])
    return {
      date: date.toISOString().slice(0, 10),
      rules: rules.map((r) => ({
        ...toRuleSummary(r),
        completed: completedRuleIds.has(r.id)
      })),
      completions: completions.map(toCompletionSummary)
    }
  })

  // ─── POST /api/mcp/recurring/rules/batch → manage_recurring_rules ──

  router.addRoute<{ actions: RecurringRuleAction[] }>(
    'POST',
    '/api/mcp/recurring/rules/batch',
    (_, body): { results: ManageRecurringRuleResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const results = processBatchActions<RecurringRuleAction, ManageRecurringRuleResult>(
        body.actions,
        (action) => {
          if (action.action === 'create') {
            const startDate = requireDate(action.startDate, 'startDate')
            const endDate = parseDate(action.endDate, 'endDate') ?? null
            const created = recurringRuleService.create(wsId, {
              title: action.title,
              description: action.description,
              priority: action.priority,
              recurrenceType: action.recurrenceType,
              daysOfWeek: action.daysOfWeek,
              startDate,
              endDate,
              startTime: action.startTime ?? null,
              endTime: action.endTime ?? null,
              reminderOffsetMs: action.reminderOffsetMs ?? null
            })
            return { action: 'create', id: created.id, success: true }
          }
          if (action.action === 'update') {
            assertValidId(action.id, 'rule id')
            const existing = recurringRuleRepository.findById(action.id)
            assertOwnedByWorkspace(existing, wsId, `Recurring rule not found: ${action.id}`)
            recurringRuleService.update(action.id, {
              title: action.title,
              description: action.description,
              priority: action.priority,
              recurrenceType: action.recurrenceType,
              daysOfWeek: action.daysOfWeek,
              startDate: parseDate(action.startDate, 'startDate'),
              endDate: action.endDate === null ? null : parseDate(action.endDate, 'endDate'),
              startTime: action.startTime,
              endTime: action.endTime,
              reminderOffsetMs: action.reminderOffsetMs
            })
            return { action: 'update', id: action.id, success: true }
          }
          // delete
          assertValidId(action.id, 'rule id')
          const existing = recurringRuleRepository.findById(action.id)
          assertOwnedByWorkspace(existing, wsId, `Recurring rule not found: ${action.id}`)
          recurringRuleService.delete(action.id)
          return { action: 'delete', id: action.id, success: true }
        },
        { transactional: true }
      )

      broadcastChanged('recurring-rule:changed', wsId, [])
      return { results }
    }
  )

  // ─── POST /api/mcp/recurring/complete → complete_recurring ──

  router.addRoute<{ ruleId: string; date: string }>(
    'POST',
    '/api/mcp/recurring/complete',
    (_, body) => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      assertValidId(body.ruleId, 'ruleId')
      const date = requireDate(body.date, 'date')
      const rule = recurringRuleRepository.findById(body.ruleId)
      assertOwnedByWorkspace(rule, wsId, `Recurring rule not found: ${body.ruleId}`)
      const completion = recurringCompletionService.complete(body.ruleId, date)
      broadcastChanged('recurring-completion:changed', wsId, [])
      return { completion: toCompletionSummary(completion) }
    }
  )

  // ─── POST /api/mcp/recurring/uncomplete → uncomplete_recurring ──

  router.addRoute<{ completionId: string }>('POST', '/api/mcp/recurring/uncomplete', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    assertValidId(body.completionId, 'completionId')
    const existing = recurringCompletionRepository.findById(body.completionId)
    if (!existing) throw new NotFoundError(`Completion not found: ${body.completionId}`)
    if (existing.workspaceId !== wsId) {
      throw new NotFoundError(`Completion not found: ${body.completionId}`)
    }
    recurringCompletionService.uncomplete(body.completionId)
    broadcastChanged('recurring-completion:changed', wsId, [])
    return { success: true }
  })
}
