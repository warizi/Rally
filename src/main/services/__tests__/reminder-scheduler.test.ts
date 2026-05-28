/**
 * reminderScheduler 단위 테스트.
 *
 * - start/stop: setInterval 등록·해제
 * - checkAndFire: pending todo/schedule reminder + 반복할일 알림 발송
 * - stale 가드 (5분 초과면 markFired 만 하고 알림 스킵)
 * - 같은 날 같은 룰은 한 번만 알림 (firedRecurringReminders set)
 *
 * Electron(Notification/BrowserWindow), reminderService, recurringRuleService,
 * workspaceService 를 모두 mock. fake timer 로 setInterval 동작 검증.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { getAllWindowsMock } = vi.hoisted(() => ({
  getAllWindowsMock: vi.fn(() => [])
}))

vi.mock('electron', () => {
  // Notification 은 `new Notification(opts)` 형태로 호출됨. mock 인스턴스를 추적하려면
  // class 처럼 동작하는 vi.fn 으로 정의. 호출 인자는 .mock.calls, 인스턴스는 .mock.instances 로 검증.
  const NotificationMock = vi.fn(function (this: { show: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> }) {
    this.show = vi.fn()
    this.on = vi.fn()
  })
  return {
    Notification: NotificationMock,
    BrowserWindow: { getAllWindows: getAllWindowsMock }
  }
})

vi.mock('../reminder', () => ({
  reminderService: {
    findPendingWithTitle: vi.fn(),
    markFired: vi.fn()
  }
}))
vi.mock('../recurring-rule', () => ({
  recurringRuleService: {
    findTodayRules: vi.fn()
  }
}))
vi.mock('../workspace', () => ({
  workspaceService: {
    getAll: vi.fn()
  }
}))
vi.mock('../../lib/logger', () => ({
  scoped: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))
vi.mock('../../../../resources/256x256.png?asset', () => ({ default: '/dev/null/icon.png' }))

import { Notification } from 'electron'
import { reminderScheduler } from '../reminder-scheduler'
import { reminderService } from '../reminder'
import { recurringRuleService } from '../recurring-rule'
import { workspaceService } from '../workspace'

type PendingReminder = ReturnType<typeof reminderService.findPendingWithTitle>[number]

const WS = {
  id: 'ws-aabbcc1',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-29T10:00:00Z'))
  // clearAllMocks: 호출 기록만 비우고 hoisted Notification factory 구현체는 보존.
  // resetAllMocks 사용 시 Notification factory 가 undefined 반환 vi.fn() 으로 바뀌어
  // fireNotification 내부에서 throw → 전부 silent fail.
  vi.clearAllMocks()
  vi.mocked(reminderService.findPendingWithTitle).mockReturnValue([])
  vi.mocked(workspaceService.getAll).mockReturnValue([])
  vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([])
  getAllWindowsMock.mockReturnValue([])
})

afterEach(() => {
  reminderScheduler.stop()
  vi.useRealTimers()
})

describe('reminderScheduler', () => {
  it('start() → 즉시 1회 + setInterval(1min) 등록', () => {
    reminderScheduler.start()

    // 즉시 호출
    expect(reminderService.findPendingWithTitle).toHaveBeenCalledTimes(1)

    // 1분 뒤 추가 호출
    vi.advanceTimersByTime(60_000)
    expect(reminderService.findPendingWithTitle).toHaveBeenCalledTimes(2)
  })

  it('start() 중복 호출 → 기존 interval 유지 (재등록 X)', () => {
    reminderScheduler.start()
    reminderScheduler.start()

    expect(reminderService.findPendingWithTitle).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_000)
    // 중복 등록이면 호출 회수가 4 이상이어야 함 — 2여야 정상
    expect(reminderService.findPendingWithTitle).toHaveBeenCalledTimes(2)
  })

  it('stop() → interval 해제 (이후 advance 해도 호출 없음)', () => {
    reminderScheduler.start()
    reminderScheduler.stop()

    const before = vi.mocked(reminderService.findPendingWithTitle).mock.calls.length
    vi.advanceTimersByTime(120_000)
    expect(reminderService.findPendingWithTitle).toHaveBeenCalledTimes(before)
  })

  it('pending reminder → Notification 발송 + markFired', () => {
    vi.mocked(reminderService.findPendingWithTitle).mockReturnValue([
      {
        id: 'rem-aabbcc1',
        entityType: 'todo',
        entityId: 'todo-aabbcc1',
        offsetMs: 10 * 60 * 1000,
        remindAt: new Date('2026-05-29T09:59:30Z'),
        isFired: false,
        title: '회의 준비',
        workspaceId: WS.id
      } as unknown as PendingReminder
    ])

    reminderScheduler.start()

    expect(Notification).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('할 일'), body: '회의 준비' })
    )
    // 생성된 mock 인스턴스의 show() 호출 검증
    const instance = vi.mocked(Notification).mock.instances[0] as unknown as {
      show: ReturnType<typeof vi.fn>
    }
    expect(instance.show).toHaveBeenCalled()
    expect(reminderService.markFired).toHaveBeenCalledWith('rem-aabbcc1')
  })

  it('STALE(5분 초과 지난) reminder → 알림 스킵 + markFired 만', () => {
    vi.mocked(reminderService.findPendingWithTitle).mockReturnValue([
      {
        id: 'rem-stale01',
        entityType: 'todo',
        entityId: 'todo-aabbcc1',
        offsetMs: 0,
        remindAt: new Date('2026-05-29T09:50:00Z'), // 10분 전 = stale (> 5분)
        isFired: false,
        title: '지난 알림',
        workspaceId: WS.id
      } as unknown as PendingReminder
    ])

    reminderScheduler.start()

    expect(Notification).not.toHaveBeenCalled()
    expect(reminderService.markFired).toHaveBeenCalledWith('rem-stale01')
  })

  it('반복할일 알림: startTime + reminderOffsetMs 매치 시 알림 + 같은 날 중복 차단', () => {
    vi.mocked(workspaceService.getAll).mockReturnValue([WS])
    vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([
      {
        id: 'rule-aabbcc1',
        workspaceId: WS.id,
        title: '데일리 스탠드업',
        description: '',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        // 19:10 KST (local). System time도 같은 zone 으로 두고 reminderOffset 10분.
        startTime: '19:10',
        endTime: null,
        startDate: new Date(),
        endDate: null,
        reminderOffsetMs: 10 * 60 * 1000, // 10분 전
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user',
        createdById: null,
        updatedBy: 'user',
        updatedById: null
      }
    ] as unknown as Parameters<typeof recurringRuleService.findTodayRules>['length'] extends 0 ? never : ReturnType<typeof recurringRuleService.findTodayRules>)

    // 시스템 시각을 19:00 으로 (10분 전 == 알림 시각)
    vi.setSystemTime(new Date('2026-05-29T10:00:00Z'))
    const now = new Date()
    now.setHours(19, 0, 0, 0)
    vi.setSystemTime(now)

    reminderScheduler.start()

    expect(Notification).toHaveBeenCalledWith(
      expect.objectContaining({ body: '데일리 스탠드업' })
    )
    const firstCallCount = vi.mocked(Notification).mock.calls.length

    // 1분 뒤 다시 fire — 같은 날 같은 룰은 중복 발송 안 됨
    vi.advanceTimersByTime(60_000)
    expect(vi.mocked(Notification).mock.calls.length).toBe(firstCallCount)
  })

  it('반복할일: reminderOffsetMs 가 null 이면 스킵', () => {
    vi.mocked(workspaceService.getAll).mockReturnValue([WS])
    vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([
      {
        id: 'rule-norem01',
        workspaceId: WS.id,
        title: 'no reminder',
        description: '',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startTime: '10:00',
        endTime: null,
        startDate: new Date(),
        endDate: null,
        reminderOffsetMs: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user',
        createdById: null,
        updatedBy: 'user',
        updatedById: null
      }
    ] as unknown as ReturnType<typeof recurringRuleService.findTodayRules>)

    reminderScheduler.start()

    expect(Notification).not.toHaveBeenCalled()
  })
})
