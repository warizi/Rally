/**
 * MCP recurring 라우트 단위 테스트.
 * - GET  /api/mcp/recurring/rules           (list + activeOnly)
 * - GET  /api/mcp/recurring/today           (today rules + completions + completed flag)
 * - POST /api/mcp/recurring/rules/batch     (manage_recurring_rules)
 * - POST /api/mcp/recurring/complete        (single complete + broadcast)
 * - POST /api/mcp/recurring/uncomplete      (single uncomplete + cross-workspace 차단)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpRecurringRoutes } from '../recurring'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/recurring-rule', () => ({
  recurringRuleService: {
    findByWorkspace: vi.fn(),
    findTodayRules: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('../../../../repositories/recurring-rule', () => ({
  recurringRuleRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/recurring-completion', () => ({
  recurringCompletionService: {
    findTodayByWorkspace: vi.fn(),
    complete: vi.fn(),
    uncomplete: vi.fn()
  }
}))
vi.mock('../../../../repositories/recurring-completion', () => ({
  recurringCompletionRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { recurringRuleService } from '../../../../services/recurring-rule'
import type { RecurringRuleItem } from '../../../../services/recurring-rule'
import { recurringRuleRepository } from '../../../../repositories/recurring-rule'
import { recurringCompletionService } from '../../../../services/recurring-completion'
import { recurringCompletionRepository } from '../../../../repositories/recurring-completion'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type RecurringRule = NonNullable<ReturnType<typeof recurringRuleRepository.findById>>
type RecurringCompletion = NonNullable<ReturnType<typeof recurringCompletionRepository.findById>>
type CompletionFromService = ReturnType<typeof recurringCompletionService.complete>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const RULE: RecurringRule = {
  id: 'rule-aabbcc12',
  workspaceId: WS.id,
  title: 'Daily standup',
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
} as unknown as RecurringRule

const COMPLETION = {
  id: 'comp-aabbcc12',
  ruleId: RULE.id,
  ruleTitle: RULE.title,
  workspaceId: WS.id,
  completedDate: '2026-05-29',
  completedAt: new Date('2026-05-29T10:00:00Z'),
  createdAt: new Date('2026-05-29T10:00:00Z'),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as RecurringCompletion

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.clearAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(recurringRuleService.findByWorkspace).mockReturnValue([])
  vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([])
  vi.mocked(recurringCompletionService.findTodayByWorkspace).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpRecurringRoutes(router)
  return router
}

describe('GET /api/mcp/recurring/rules', () => {
  it('전체 rules 직렬화', async () => {
    vi.mocked(recurringRuleService.findByWorkspace).mockReturnValue([
      RULE as unknown as RecurringRuleItem
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/recurring/rules',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ rules: { id: string; startDate: string }[] }>()
    expect(body.rules).toHaveLength(1)
    expect(body.rules[0].startDate).toBe('2026-01-01T00:00:00.000Z')
  })

  it('activeOnly=true → endDate 과거인 룰 제외', async () => {
    const expired = {
      ...RULE,
      id: 'rule-expired12',
      endDate: new Date('2020-01-01T00:00:00Z')
    } as unknown as RecurringRule
    vi.mocked(recurringRuleService.findByWorkspace).mockReturnValue([
      RULE as unknown as RecurringRuleItem,
      expired as unknown as RecurringRuleItem
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/recurring/rules?activeOnly=true',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ rules: { id: string }[] }>()
    expect(body.rules.map((r) => r.id)).toEqual([RULE.id])
  })
})

describe('GET /api/mcp/recurring/today', () => {
  it('rules + completions 동시 반환 + completed 플래그', async () => {
    vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([
      RULE as unknown as RecurringRuleItem
    ])
    vi.mocked(recurringCompletionService.findTodayByWorkspace).mockReturnValue([COMPLETION])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/recurring/today',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      rules: { id: string; completed: boolean }[]
      completions: { id: string }[]
      date: string
    }>()
    expect(body.rules[0].completed).toBe(true)
    expect(body.completions).toHaveLength(1)
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('잘못된 date → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/recurring/today?date=not-a-date',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('POST /api/mcp/recurring/rules/batch', () => {
  it('create → 성공 + recurring-rule:changed broadcast', async () => {
    vi.mocked(recurringRuleService.create).mockReturnValue(RULE as unknown as RecurringRuleItem)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/rules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'create',
            title: 'New',
            description: '',
            priority: 'medium',
            recurrenceType: 'daily',
            startDate: '2026-05-01T00:00:00Z'
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(recurringRuleService.create).toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenCalledWith('recurring-rule:changed', WS.id, [])
  })

  it('complete → recurring-completion:changed broadcast', async () => {
    vi.mocked(recurringRuleRepository.findById).mockReturnValue(RULE)
    vi.mocked(recurringCompletionService.complete).mockReturnValue(
      COMPLETION as unknown as CompletionFromService
    )

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/rules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'complete', ruleId: RULE.id, date: '2026-05-29' }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith('recurring-completion:changed', WS.id, [])
  })

  it('빈 actions → 400 (processBatchActions)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/rules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('startDate 누락된 create → 400 (requireDate)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/rules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'create',
            title: 'x',
            description: '',
            priority: 'medium',
            recurrenceType: 'daily'
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('POST /api/mcp/recurring/complete', () => {
  it('정상 → completion 반환 + broadcast', async () => {
    vi.mocked(recurringRuleRepository.findById).mockReturnValue(RULE)
    vi.mocked(recurringCompletionService.complete).mockReturnValue(
      COMPLETION as unknown as CompletionFromService
    )

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/complete',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ruleId: RULE.id, date: '2026-05-29' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ completion: { id: string; completedDate: string } }>()
    expect(body.completion.id).toBe(COMPLETION.id)
    expect(body.completion.completedDate).toBe('2026-05-29')
    expect(broadcastMock).toHaveBeenCalledWith('recurring-completion:changed', WS.id, [])
  })

  it('존재하지 않는 ruleId → 404', async () => {
    vi.mocked(recurringRuleRepository.findById).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/complete',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ruleId: 'rule-missing1', date: '2026-05-29' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
  })
})

describe('POST /api/mcp/recurring/uncomplete', () => {
  it('정상 → uncomplete + broadcast', async () => {
    vi.mocked(recurringCompletionRepository.findById).mockReturnValue(COMPLETION)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/uncomplete',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { completionId: COMPLETION.id }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(recurringCompletionService.uncomplete).toHaveBeenCalledWith(COMPLETION.id)
  })

  it('다른 워크스페이스의 completion → 404 (정보 노출 방지)', async () => {
    vi.mocked(recurringCompletionRepository.findById).mockReturnValue({
      ...COMPLETION,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as RecurringCompletion)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/recurring/uncomplete',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { completionId: COMPLETION.id }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
    expect(recurringCompletionService.uncomplete).not.toHaveBeenCalled()
  })
})
