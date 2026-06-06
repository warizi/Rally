/**
 * MCP tasks 라우트 단위 테스트.
 * - GET /api/mcp/tasks (read_tasks v2)
 *
 * 흡수: list_todos + list_schedules + list_reminders + list_recurring_rules + get_history.
 * 본 테스트는 mode (active/today/completed) × types 디스패치 + 입력 검증을 다룬다.
 * 각 타입 내부 매핑은 sample 데이터로 happy path 만 검증 (세부 분기는 service 단위 테스트가 담당).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpTasksRoutes } from '../tasks'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

vi.mock('../../../../services/todo', () => ({
  todoService: {
    findByWorkspace: vi.fn(),
    findByWorkspaceFiltered: vi.fn()
  }
}))
vi.mock('../../../../repositories/todo', () => ({
  todoRepository: {
    findById: vi.fn(),
    findByWorkspaceWithFilters: vi.fn()
  }
}))
vi.mock('../../../../services/entity-link', () => ({
  entityLinkService: {
    getLinkedBatch: vi.fn(),
    getLinkedBatchWithPreview: vi.fn()
  }
}))
vi.mock('../../../../services/schedule', () => ({
  scheduleService: {
    findByWorkspace: vi.fn(),
    findAllByWorkspace: vi.fn()
  }
}))
vi.mock('../../../../services/reminder', () => ({
  reminderService: {
    findByEntity: vi.fn()
  }
}))
vi.mock('../../../../repositories/reminder', () => ({
  reminderRepository: {}
}))
vi.mock('../../../../services/recurring-rule', () => ({
  recurringRuleService: {
    findByWorkspace: vi.fn(),
    findTodayRules: vi.fn()
  }
}))
vi.mock('../../../../services/recurring-completion', () => ({
  recurringCompletionService: {
    findTodayByWorkspace: vi.fn()
  }
}))
vi.mock('../../../../repositories/schedule', () => ({
  scheduleRepository: {
    findById: vi.fn(),
    findAllByWorkspaceId: vi.fn()
  }
}))
vi.mock('../../../../services/history', () => ({
  historyService: {
    fetch: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { todoService } from '../../../../services/todo'
import type { TodoItem } from '../../../../services/todo'
import { todoRepository } from '../../../../repositories/todo'
import { entityLinkService } from '../../../../services/entity-link'
import { scheduleService } from '../../../../services/schedule'
import { recurringRuleService } from '../../../../services/recurring-rule'
import type { RecurringRuleItem } from '../../../../services/recurring-rule'
import { recurringCompletionService } from '../../../../services/recurring-completion'
import { scheduleRepository } from '../../../../repositories/schedule'
import { reminderService } from '../../../../services/reminder'
import { historyService, type HistoryTodoEntry } from '../../../../services/history'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const baseTodo = {
  id: 't1aaaaaaaaaa',
  workspaceId: WS.id,
  parentId: null,
  title: 'todo A',
  description: null,
  status: '진행중',
  priority: 'medium',
  isDone: false,
  dueDate: null,
  startDate: null,
  doneAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  order: 0,
  subOrder: 0,
  kanbanOrder: 0,
  listOrder: 0,
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as TodoItem

function historyEntry(partial: Partial<HistoryTodoEntry>): HistoryTodoEntry {
  return {
    id: 't1',
    title: 'A',
    doneAt: new Date('2026-05-01T10:00:00Z'),
    kind: 'todo',
    links: [],
    parentId: null,
    parentTitle: null,
    createdBy: 'user',
    createdById: null,
    updatedBy: 'user',
    updatedById: null,
    ...partial
  }
}

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.clearAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(entityLinkService.getLinkedBatch).mockReturnValue(new Map())
  vi.mocked(entityLinkService.getLinkedBatchWithPreview).mockReturnValue(new Map())
  vi.mocked(todoService.findByWorkspace).mockReturnValue([])
  vi.mocked(scheduleService.findAllByWorkspace).mockReturnValue([])
  vi.mocked(recurringRuleService.findByWorkspace).mockReturnValue([])
  vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([])
  vi.mocked(recurringCompletionService.findTodayByWorkspace).mockReturnValue([])
  vi.mocked(todoRepository.findByWorkspaceWithFilters).mockReturnValue([])
  vi.mocked(scheduleRepository.findAllByWorkspaceId).mockReturnValue([])
  vi.mocked(reminderService.findByEntity).mockReturnValue([])
  vi.mocked(historyService.fetch).mockReturnValue({ days: [], hasMore: false, nextDayOffset: 0 })
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpTasksRoutes(router)
  return router
}

describe('GET /api/mcp/tasks (mode=active default)', () => {
  it('types 미지정 → 4종 entity 모두 응답 키에 포함', async () => {
    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/tasks', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<Record<string, unknown>>()
    expect(body.todos).toBeDefined()
    expect(body.schedules).toBeDefined()
    expect(body.recurring).toBeDefined()
    expect(body.reminders).toBeDefined()
  })

  it('types=todo → todos 만 응답', async () => {
    vi.mocked(todoService.findByWorkspace).mockReturnValue([baseTodo])
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?types=todo',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<Record<string, unknown>>()
    expect(body.todos).toBeDefined()
    expect(body.schedules).toBeUndefined()
    expect(body.recurring).toBeUndefined()
    expect(body.reminders).toBeUndefined()
  })

  it('필터 인자(parentId/dueWithin/priority/search) → findByWorkspaceFiltered 분기', async () => {
    vi.mocked(todoService.findByWorkspaceFiltered).mockReturnValue([baseTodo])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?types=todo&parentId=null&dueWithin=7&priority=high&search=meet',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(todoService.findByWorkspaceFiltered).toHaveBeenCalled()
    expect(todoService.findByWorkspace).not.toHaveBeenCalled()
  })

  it('잘못된 type → 400 VALIDATION', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?types=bogus',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    expect(cap.getJson<{ code: string }>().code).toBe('VALIDATION')
  })

  it('잘못된 mode → 400 VALIDATION', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?mode=weird',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('잘못된 priority → 400 VALIDATION', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?types=todo&priority=urgent',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('GET /api/mcp/tasks?mode=today', () => {
  it('todo/schedule/recurring 응답 + recurring completed 플래그', async () => {
    const ruleId = 'ru-aaaaaaaaaa'
    vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([
      {
        id: ruleId,
        workspaceId: WS.id,
        title: 'daily',
        description: '',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: null,
        startTime: null,
        endTime: null,
        reminderOffsetMs: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        createdBy: 'user',
        createdById: null,
        updatedBy: 'user',
        updatedById: null
      } satisfies Partial<RecurringRuleItem> as RecurringRuleItem
    ])
    vi.mocked(recurringCompletionService.findTodayByWorkspace).mockReturnValue([
      {
        id: 'rc-aaaaaaaa',
        ruleId,
        ruleTitle: 'daily',
        workspaceId: WS.id,
        completedDate: '2026-05-29',
        completedAt: new Date('2026-05-29T10:00:00Z'),
        createdAt: new Date('2026-05-29T10:00:00Z')
      }
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?mode=today&types=recurring',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      recurring: { id: string; completed: boolean }[]
      recurringCompletions: unknown[]
    }>()
    expect(body.recurring).toHaveLength(1)
    expect(body.recurring[0].completed).toBe(true)
    expect(body.recurringCompletions).toHaveLength(1)
  })

  it('잘못된 date → 400 VALIDATION', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?mode=today&date=not-a-date',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('GET /api/mcp/tasks?mode=completed', () => {
  it('historyService.fetch 위임 + types 필터로 todo/recurring 분리', async () => {
    vi.mocked(historyService.fetch).mockReturnValue({
      days: [
        {
          date: '2026-05-28',
          todos: [
            historyEntry({
              id: 't1',
              title: 'done todo',
              doneAt: new Date('2026-05-28T15:00:00Z'),
              kind: 'todo'
            }),
            historyEntry({
              id: 'rc1',
              title: 'done recurring',
              doneAt: new Date('2026-05-28T16:00:00Z'),
              kind: 'recurring'
            })
          ]
        }
      ],
      hasMore: false,
      nextDayOffset: 0
    })

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?mode=completed&types=todo,recurring',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      days: { todos: unknown[]; recurringCompletions: unknown[] }[]
    }>()
    expect(body.days[0].todos).toHaveLength(1)
    expect(body.days[0].recurringCompletions).toHaveLength(1)
  })

  it('types=schedule → days 는 비어있지만 schedules:[] 응답', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?mode=completed&types=schedule',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ schedules: unknown[] }>()
    expect(body.schedules).toEqual([])
  })
})

describe('GET /api/mcp/tasks — search 필터 (recurring / reminder)', () => {
  function rule(partial: Partial<RecurringRuleItem>): RecurringRuleItem {
    return {
      id: 'r1',
      workspaceId: WS.id,
      title: 'rule',
      description: '',
      priority: 'medium',
      recurrenceType: 'daily',
      daysOfWeek: null,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      startTime: null,
      endTime: null,
      reminderOffsetMs: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      createdBy: 'user',
      createdById: null,
      updatedBy: 'user',
      updatedById: null,
      ...partial
    }
  }

  function reminder(entityId: string): ReturnType<typeof reminderService.findByEntity>[number] {
    return {
      id: `rem-${entityId}`,
      entityType: 'todo',
      entityId,
      offsetMs: 600_000,
      remindAt: new Date('2026-05-01T09:00:00Z'),
      isFired: false,
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z')
    } as unknown as ReturnType<typeof reminderService.findByEntity>[number]
  }

  it('recurring: search 가 title/description 에 적용된다', async () => {
    vi.mocked(recurringRuleService.findByWorkspace).mockReturnValue([
      rule({ id: 'r1', title: 'morning gym' }),
      rule({ id: 'r2', title: 'weekly sync' })
    ])
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?types=recurring&search=gym',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ recurring: { id: string }[] }>()
    expect(body.recurring).toHaveLength(1)
    expect(body.recurring[0].id).toBe('r1')
  })

  it('reminder: search 가 부모 엔티티(todo) 매칭으로 적용된다', async () => {
    const matchTodo = { ...baseTodo, id: 'tmatchaaaaaa', title: 'morning gym' }
    const noTodo = { ...baseTodo, id: 'tnoaaaaaaaaaa', title: 'weekly sync' }
    vi.mocked(todoRepository.findByWorkspaceWithFilters).mockReturnValue([
      matchTodo,
      noTodo
    ] as unknown as ReturnType<typeof todoRepository.findByWorkspaceWithFilters>)
    vi.mocked(scheduleRepository.findAllByWorkspaceId).mockReturnValue([])
    vi.mocked(reminderService.findByEntity).mockImplementation((_type, id) =>
      id === 'tmatchaaaaaa' ? [reminder('tmatchaaaaaa')] : []
    )
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tasks?types=reminder&search=gym',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ reminders: { entityId: string }[] }>()
    expect(body.reminders).toHaveLength(1)
    expect(body.reminders[0].entityId).toBe('tmatchaaaaaa')
    // 비매칭 부모는 reminder 조회 자체를 건너뛴다
    expect(reminderService.findByEntity).not.toHaveBeenCalledWith('todo', 'tnoaaaaaaaaaa')
  })
})
