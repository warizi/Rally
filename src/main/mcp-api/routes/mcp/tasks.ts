/**
 * MCP v2 read_tasks 라우트.
 *
 * 흡수: list_todos + list_schedules + list_reminders + list_recurring_rules + get_history.
 *
 * Work 클러스터(시간·상태가 있는 모든 것) 통합 조회. types + mode discriminator 로 한 도구가
 * 4종 entity 와 3가지 mode 를 처리.
 *
 * - mode='active' (default): 미완 todo + 예정 schedule + 활성 recurring rule + 미발화 reminder
 * - mode='today': 오늘 due/firing 모두 (recurring 은 completed 플래그 포함)
 * - mode='completed': historyService 위임 — 완료 todo + recurring completion 을 일자별 그룹
 *     (schedule/reminder 의 과거 항목은 mode='active' + from/to 로 조회 권장)
 */
import type { Router } from '../../router'
import { ValidationError } from '../../../lib/errors'
import { todoService } from '../../../services/todo'
import { todoRepository } from '../../../repositories/todo'
import { entityLinkService } from '../../../services/entity-link'
import { scheduleService } from '../../../services/schedule'
import { reminderService } from '../../../services/reminder'
import { reminderRepository } from '../../../repositories/reminder'
import { recurringRuleService } from '../../../services/recurring-rule'
import { recurringCompletionService } from '../../../services/recurring-completion'
import { scheduleRepository } from '../../../repositories/schedule'
import { historyService } from '../../../services/history'
import type { LinkableEntityType } from '../../../db/schema/entity-link'
import { resolveActiveWorkspace, assertValidId } from './helpers'

type TaskType = 'todo' | 'schedule' | 'recurring' | 'reminder'
type TaskMode = 'active' | 'completed' | 'today'

const ALL_TASK_TYPES: readonly TaskType[] = ['todo', 'schedule', 'recurring', 'reminder']
const VALID_TASK_TYPES = new Set<TaskType>(ALL_TASK_TYPES)
const VALID_MODES = new Set<TaskMode>(['active', 'completed', 'today'])

const VALID_LINK_TYPES = new Set<LinkableEntityType>([
  'note',
  'csv',
  'canvas',
  'todo',
  'pdf',
  'image',
  'schedule'
])
const VALID_PRIORITIES = new Set<'high' | 'medium' | 'low'>(['high', 'medium', 'low'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseTypesParam(query: URLSearchParams): TaskType[] | undefined {
  const csv = query.get('types')
  const repeat = query.getAll('types[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const t of cleaned) {
    if (!VALID_TASK_TYPES.has(t as TaskType)) {
      throw new ValidationError(
        `Invalid type: ${t}. Must be one of ${ALL_TASK_TYPES.join(', ')}.`
      )
    }
  }
  return cleaned as TaskType[]
}

function parseModeParam(query: URLSearchParams): TaskMode {
  const raw = query.get('mode') ?? 'active'
  if (!VALID_MODES.has(raw as TaskMode)) {
    throw new ValidationError(`Invalid mode: ${raw}. Must be one of active, completed, today.`)
  }
  return raw as TaskMode
}

function parsePriorityParam(query: URLSearchParams): ('high' | 'medium' | 'low')[] | undefined {
  const csv = query.get('priority')
  const repeat = query.getAll('priority[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const p of cleaned) {
    if (!VALID_PRIORITIES.has(p as 'high' | 'medium' | 'low')) {
      throw new ValidationError(`Invalid priority: ${p}.`)
    }
  }
  return cleaned as ('high' | 'medium' | 'low')[]
}

function parseLinkedTo(query: URLSearchParams): { type: LinkableEntityType; id: string } | null {
  const t = query.get('linkedTo[type]')
  const i = query.get('linkedTo[id]')
  if (t === null && i === null) return null
  if (t === null || i === null) {
    throw new ValidationError('linkedTo requires both type and id')
  }
  if (!VALID_LINK_TYPES.has(t as LinkableEntityType)) {
    throw new ValidationError(`Invalid linkedTo type: ${t}`)
  }
  assertValidId(i, 'linkedTo.id')
  return { type: t as LinkableEntityType, id: i }
}

function parseIso(raw: string | null, label: string): Date | undefined {
  if (raw === null || raw === '') return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date`)
  }
  return d
}

function parseDateKey(raw: string | null, label: string): string | undefined {
  if (raw === null || raw === '') return undefined
  if (!DATE_RE.test(raw)) {
    throw new ValidationError(`${label} must be YYYY-MM-DD`)
  }
  return raw
}

function parseNonNegInt(raw: string | null, label: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || `${n}` !== raw) {
    throw new ValidationError(`${label} must be a non-negative integer`)
  }
  return n
}

// ────────────────────────────────────────────────────────────
// Type-specific readers
// ────────────────────────────────────────────────────────────

interface TodoFilterOptions {
  filter: 'all' | 'active' | 'completed'
  parentId?: string | null
  linkedTo?: { type: LinkableEntityType; id: string }
  dueWithin?: number
  priority?: ('high' | 'medium' | 'low')[]
  search?: string
}

function readTodos(
  wsId: string,
  query: URLSearchParams,
  filter: 'all' | 'active' | 'completed',
  resolveLinks: boolean
): unknown {
  const parentIdRaw = query.get('parentId')
  let parentId: string | null | undefined
  if (parentIdRaw === null) parentId = undefined
  else if (parentIdRaw === 'null' || parentIdRaw === '') parentId = null
  else {
    assertValidId(parentIdRaw, 'parentId')
    parentId = parentIdRaw
  }

  const linkedTo = parseLinkedTo(query) ?? undefined
  const dueWithin = parseNonNegInt(query.get('dueWithin'), 'dueWithin')
  const priority = parsePriorityParam(query)
  const search = query.get('search') ?? undefined

  const filters: TodoFilterOptions = {
    filter,
    parentId,
    linkedTo,
    dueWithin,
    priority,
    search
  }
  const useFilters =
    parentId !== undefined ||
    linkedTo !== undefined ||
    dueWithin !== undefined ||
    priority !== undefined ||
    (search !== undefined && search.trim().length > 0)

  const todos = useFilters
    ? todoService.findByWorkspaceFiltered(wsId, filters)
    : todoService.findByWorkspace(wsId, filter)

  const todoIds = todos.map((t) => t.id)
  const linksMap = resolveLinks
    ? entityLinkService.getLinkedBatchWithPreview('todo', todoIds)
    : entityLinkService.getLinkedBatch('todo', todoIds)

  interface MappedTodo {
    id: string
    parentId: string | null
    title: string
    description: string | null
    status: string
    priority: string
    isDone: boolean
    dueDate: string | null
    startDate: string | null
    createdAt: string
    updatedAt: string
    linkedItems: { type: string; id: string; title: string | null; preview: string | null }[]
    children: MappedTodo[]
  }

  const mapped: MappedTodo[] = todos.map((t) => {
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
  })

  const byId = new Map(mapped.map((t) => [t.id, t]))
  const roots: MappedTodo[] = []
  for (const todo of mapped) {
    if (todo.parentId && byId.has(todo.parentId)) byId.get(todo.parentId)!.children.push(todo)
    else roots.push(todo)
  }
  return roots
}

function readSchedules(wsId: string, query: URLSearchParams): unknown {
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

  return items.map((s) => ({
    id: s.id,
    workspaceId: s.workspaceId,
    title: s.title,
    description: s.description,
    location: s.location,
    allDay: s.allDay,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    color: s.color,
    priority: s.priority,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString()
  }))
}

function readRecurringRules(wsId: string, _query: URLSearchParams, activeOnly: boolean): unknown {
  let rules = recurringRuleService.findByWorkspace(wsId)
  if (activeOnly) {
    const now = new Date()
    rules = rules.filter((r) => r.endDate === null || r.endDate >= now)
  }
  return rules.map(toRuleSummary)
}

function toRuleSummary(item: ReturnType<typeof recurringRuleService.findByWorkspace>[number]): {
  id: string
  workspaceId: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  recurrenceType: string
  daysOfWeek: number[] | null
  startDate: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  reminderOffsetMs: number | null
  createdAt: string
  updatedAt: string
} {
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

function readReminders(wsId: string, query: URLSearchParams): unknown {
  const entityType = query.get('entityType') as 'todo' | 'schedule' | null
  const entityId = query.get('entityId')
  const pendingOnly = query.get('pendingOnly') === 'true'

  let items: ReturnType<typeof reminderService.findByEntity> = []

  if (entityType && entityId) {
    if (entityType !== 'todo' && entityType !== 'schedule') {
      throw new ValidationError(`Invalid entityType: ${entityType}`)
    }
    assertValidId(entityId, 'entityId')
    // 소유권 검증
    if (entityType === 'todo') {
      const todo = todoRepository.findById(entityId)
      if (!todo || todo.workspaceId !== wsId)
        throw new ValidationError(`Todo not found in active workspace: ${entityId}`)
    } else {
      const s = scheduleRepository.findById(entityId)
      if (!s || s.workspaceId !== wsId)
        throw new ValidationError(`Schedule not found in active workspace: ${entityId}`)
    }
    items = reminderService.findByEntity(entityType, entityId)
  } else {
    const todos = todoRepository.findByWorkspaceWithFilters(wsId, { filter: 'all' })
    const schedules = scheduleRepository.findAllByWorkspaceId(wsId)
    const collected: ReturnType<typeof reminderService.findByEntity> = []
    for (const t of todos) collected.push(...reminderService.findByEntity('todo', t.id))
    for (const s of schedules) collected.push(...reminderService.findByEntity('schedule', s.id))
    items = collected
  }

  if (pendingOnly) items = items.filter((r) => !r.isFired)
  return items.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    offsetMs: r.offsetMs,
    remindAt: r.remindAt.toISOString(),
    isFired: r.isFired,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  }))
}

// ────────────────────────────────────────────────────────────
// Mode handlers
// ────────────────────────────────────────────────────────────

function handleActiveMode(
  wsId: string,
  types: TaskType[],
  query: URLSearchParams,
  resolveLinks: boolean
): Record<string, unknown> {
  const response: Record<string, unknown> = {}
  if (types.includes('todo')) response.todos = readTodos(wsId, query, 'active', resolveLinks)
  if (types.includes('schedule')) response.schedules = readSchedules(wsId, query)
  if (types.includes('recurring')) {
    const activeOnly = query.get('activeOnly') !== 'false'
    response.recurring = readRecurringRules(wsId, query, activeOnly)
  }
  if (types.includes('reminder')) response.reminders = readReminders(wsId, query)
  return response
}

function handleTodayMode(
  wsId: string,
  types: TaskType[],
  query: URLSearchParams,
  resolveLinks: boolean
): Record<string, unknown> {
  const dateRaw = query.get('date')
  let date: Date
  if (dateRaw) {
    const d = new Date(dateRaw)
    if (Number.isNaN(d.getTime())) {
      throw new ValidationError('date must be YYYY-MM-DD or ISO 8601')
    }
    date = d
  } else {
    date = new Date()
  }
  const dateKey = date.toISOString().slice(0, 10)

  const response: Record<string, unknown> = { date: dateKey }

  if (types.includes('todo')) {
    // 오늘 due 인 todo (dueWithin=0 효과). 기존 filter 인자도 존중.
    const synthetic = new URLSearchParams(query)
    synthetic.set('dueWithin', '0')
    response.todos = readTodos(wsId, synthetic, 'active', resolveLinks)
  }

  if (types.includes('schedule')) {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)
    const synthetic = new URLSearchParams(query)
    synthetic.set('from', dayStart.toISOString())
    synthetic.set('to', dayEnd.toISOString())
    response.schedules = readSchedules(wsId, synthetic)
  }

  if (types.includes('recurring')) {
    const rules = recurringRuleService.findTodayRules(wsId, date)
    const completions = recurringCompletionService.findTodayByWorkspace(wsId, date)
    const completedRuleIds = new Set(completions.map((c) => c.ruleId).filter(Boolean) as string[])
    response.recurring = rules.map((r) => ({
      ...toRuleSummary(r),
      completed: completedRuleIds.has(r.id)
    }))
    response.recurringCompletions = completions.map((c) => ({
      id: c.id,
      ruleId: c.ruleId,
      ruleTitle: c.ruleTitle,
      workspaceId: c.workspaceId,
      completedDate: c.completedDate,
      completedAt: c.completedAt.toISOString(),
      createdAt: c.createdAt.toISOString()
    }))
  }

  if (types.includes('reminder')) {
    // 오늘 firing 예정 reminder — pendingOnly 강제 적용 + 오늘 시각 범위
    const synthetic = new URLSearchParams(query)
    synthetic.set('pendingOnly', 'true')
    const all = readReminders(wsId, synthetic) as Array<{ remindAt: string }>
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)
    response.reminders = all.filter((r) => {
      const t = new Date(r.remindAt).getTime()
      return t >= dayStart.getTime() && t <= dayEnd.getTime()
    })
  }

  return response
}

function handleCompletedMode(
  wsId: string,
  types: TaskType[],
  query: URLSearchParams
): Record<string, unknown> {
  // historyService 는 완료 todo + recurring completion 을 day-grouped 으로 반환.
  // schedule/reminder 의 완료 개념은 미지원 — 빈 배열로 마킹.
  const dayOffset = parseNonNegInt(query.get('dayOffset'), 'dayOffset')
  const dayLimit = parseNonNegInt(query.get('dayLimit'), 'dayLimit')
  const fromDate = parseDateKey(query.get('fromDate'), 'fromDate')
  const toDate = parseDateKey(query.get('toDate'), 'toDate')
  const q = query.get('query') ?? undefined

  const result = historyService.fetch(wsId, {
    dayOffset,
    dayLimit,
    fromDate,
    toDate,
    query: q
  })

  // types 필터: types 에 todo / recurring 둘 다 없으면 빈 응답
  const includeTodo = types.includes('todo')
  const includeRecurring = types.includes('recurring')

  const response: Record<string, unknown> = {
    days: result.days.map((d) => ({
      date: d.date,
      todos: includeTodo
        ? d.todos
            .filter((t) => t.kind === 'todo')
            .map((t) => ({
              id: t.id,
              title: t.title,
              doneAt: t.doneAt.toISOString(),
              kind: t.kind,
              links: t.links
            }))
        : [],
      recurringCompletions: includeRecurring
        ? d.todos
            .filter((t) => t.kind === 'recurring')
            .map((t) => ({
              id: t.id,
              title: t.title,
              doneAt: t.doneAt.toISOString(),
              kind: t.kind,
              links: t.links
            }))
        : []
    })),
    hasMore: result.hasMore,
    nextDayOffset: result.nextDayOffset
  }

  // schedule / reminder 의 완료 개념 미지원 명시
  if (types.includes('schedule')) response.schedules = []
  if (types.includes('reminder')) response.reminders = []

  return response
}

// ────────────────────────────────────────────────────────────
// Route registration
// ────────────────────────────────────────────────────────────

// 참조 보존 — 일부 import 가 어떤 mode 에서만 사용되어 lint 오해 방지
void reminderRepository

export function registerMcpTasksRoutes(router: Router): void {
  router.addRoute('GET', '/api/mcp/tasks', (_p, _b, query) => {
    const wsId = resolveActiveWorkspace()
    const types = parseTypesParam(query) ?? Array.from(ALL_TASK_TYPES)
    const mode = parseModeParam(query)
    const resolveLinks = query.get('resolveLinks') === 'true'

    if (mode === 'completed') {
      return handleCompletedMode(wsId, types, query)
    }
    if (mode === 'today') {
      return handleTodayMode(wsId, types, query, resolveLinks)
    }
    // mode === 'active'
    return handleActiveMode(wsId, types, query, resolveLinks)
  })
}
