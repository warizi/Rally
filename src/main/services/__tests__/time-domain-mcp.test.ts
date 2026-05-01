import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { scheduleService } from '../schedule'
import { recurringRuleService } from '../recurring-rule'
import { recurringCompletionService } from '../recurring-completion'

// 통합 테스트 — schedules / recurring 도메인이 MCP 노출용으로 정상 동작하는지 검증.
// reminder는 기존 reminder.test.ts가 단위 커버 — 여기선 스케줄/반복 + 워크스페이스 격리 위주.

const WS_A = 'ws-a'
const WS_B = 'ws-b'

beforeEach(() => {
  testDb.delete(schema.recurringCompletions).run()
  testDb.delete(schema.recurringRules).run()
  testDb.delete(schema.schedules).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values([
      { id: WS_A, name: 'A', path: '/a', createdAt: new Date(), updatedAt: new Date() },
      { id: WS_B, name: 'B', path: '/b', createdAt: new Date(), updatedAt: new Date() }
    ])
    .run()
})

describe('scheduleService — MCP 시나리오', () => {
  it('create + findByWorkspace로 조회', () => {
    const start = new Date('2026-05-10T09:00:00Z')
    const end = new Date('2026-05-10T10:00:00Z')
    const created = scheduleService.create(WS_A, {
      title: 'Standup',
      startAt: start,
      endAt: end
    })
    const found = scheduleService.findAllByWorkspace(WS_A)
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe(created.id)
    expect(found[0].title).toBe('Standup')
  })

  it('워크스페이스 격리: WS_A의 schedule이 WS_B에 안 보임', () => {
    scheduleService.create(WS_A, {
      title: 'A schedule',
      startAt: new Date('2026-05-10T09:00:00Z'),
      endAt: new Date('2026-05-10T10:00:00Z')
    })
    expect(scheduleService.findAllByWorkspace(WS_A)).toHaveLength(1)
    expect(scheduleService.findAllByWorkspace(WS_B)).toHaveLength(0)
  })

  it('startAt > endAt면 ValidationError', () => {
    expect(() =>
      scheduleService.create(WS_A, {
        title: 'bad',
        startAt: new Date('2026-05-10T10:00:00Z'),
        endAt: new Date('2026-05-10T09:00:00Z')
      })
    ).toThrow()
  })
})

describe('recurringRuleService — MCP 시나리오', () => {
  it('daily rule create + findTodayRules', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const created = recurringRuleService.create(WS_A, {
      title: 'Daily standup',
      recurrenceType: 'daily',
      startDate: start
    })
    expect(created.title).toBe('Daily standup')

    const today = new Date()
    const rules = recurringRuleService.findTodayRules(WS_A, today)
    expect(rules.find((r) => r.id === created.id)).toBeDefined()
  })

  it('weekday rule은 토/일에 안 나옴', () => {
    recurringRuleService.create(WS_A, {
      title: 'Weekday only',
      recurrenceType: 'weekday',
      startDate: new Date('2026-01-01')
    })
    // 2026-05-02은 토요일
    const saturday = new Date('2026-05-02T12:00:00')
    expect(recurringRuleService.findTodayRules(WS_A, saturday)).toHaveLength(0)
    // 2026-05-04은 월요일
    const monday = new Date('2026-05-04T12:00:00')
    expect(recurringRuleService.findTodayRules(WS_A, monday)).toHaveLength(1)
  })

  it('custom rule은 daysOfWeek 필수', () => {
    expect(() =>
      recurringRuleService.create(WS_A, {
        title: 'bad custom',
        recurrenceType: 'custom',
        startDate: new Date()
      })
    ).toThrow()
  })

  it('endDate < startDate면 ValidationError', () => {
    expect(() =>
      recurringRuleService.create(WS_A, {
        title: 'bad range',
        recurrenceType: 'daily',
        startDate: new Date('2026-05-10'),
        endDate: new Date('2026-05-01')
      })
    ).toThrow()
  })
})

describe('recurringCompletion — 완료/되돌리기', () => {
  it('complete 멱등성: 같은 rule+date 두 번 호출해도 동일 ID', () => {
    const rule = recurringRuleService.create(WS_A, {
      title: 'Daily',
      recurrenceType: 'daily',
      startDate: new Date('2026-01-01')
    })
    const date = new Date('2026-05-01T12:00:00')
    const first = recurringCompletionService.complete(rule.id, date)
    const second = recurringCompletionService.complete(rule.id, date)
    expect(first.id).toBe(second.id)
  })

  it('uncomplete 후 같은 날 complete하면 새 ID', () => {
    const rule = recurringRuleService.create(WS_A, {
      title: 'Daily',
      recurrenceType: 'daily',
      startDate: new Date('2026-01-01')
    })
    const date = new Date('2026-05-01T12:00:00')
    const first = recurringCompletionService.complete(rule.id, date)
    recurringCompletionService.uncomplete(first.id)
    const second = recurringCompletionService.complete(rule.id, date)
    expect(second.id).not.toBe(first.id)
  })

  it('findTodayByWorkspace는 같은 ws의 해당 날짜 completion만 반환', () => {
    const ruleA = recurringRuleService.create(WS_A, {
      title: 'A daily',
      recurrenceType: 'daily',
      startDate: new Date('2026-01-01')
    })
    const ruleB = recurringRuleService.create(WS_B, {
      title: 'B daily',
      recurrenceType: 'daily',
      startDate: new Date('2026-01-01')
    })
    const date = new Date('2026-05-01T12:00:00')
    recurringCompletionService.complete(ruleA.id, date)
    recurringCompletionService.complete(ruleB.id, date)
    const aOnly = recurringCompletionService.findTodayByWorkspace(WS_A, date)
    expect(aOnly).toHaveLength(1)
    expect(aOnly[0].ruleId).toBe(ruleA.id)
  })
})
