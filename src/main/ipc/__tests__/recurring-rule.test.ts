/**
 * recurring-rule IPC 핸들러 회귀 테스트.
 * create/update 는 startDate/endDate 를 Date 로 재변환하는 분기 포함.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/recurring-rule', () => ({
  recurringRuleService: {
    findByWorkspace: vi.fn(),
    findTodayRules: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

import { registerRecurringRuleHandlers } from '../recurring-rule'
import { recurringRuleService } from '../../services/recurring-rule'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerRecurringRuleHandlers()
})

describe('recurring-rule IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'recurringRule:findByWorkspace',
      'recurringRule:findToday',
      'recurringRule:create',
      'recurringRule:update',
      'recurringRule:delete'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('recurringRule:findToday → date 를 새 Date 로 wrap', () => {
    vi.mocked(recurringRuleService.findTodayRules).mockReturnValue([])
    const input = new Date('2026-05-29')
    getHandler('recurringRule:findToday')({}, 'ws-aabbcc12', input)
    expect(recurringRuleService.findTodayRules).toHaveBeenCalledWith('ws-aabbcc12', expect.any(Date))
  })

  it('recurringRule:create → startDate Date 변환 + endDate null 정상 처리', () => {
    vi.mocked(recurringRuleService.create).mockReturnValue({ id: 'rule-newaab' } as ReturnType<typeof recurringRuleService.create>)

    getHandler('recurringRule:create')({}, 'ws-aabbcc12', {
      title: 'daily',
      recurrenceType: 'daily',
      startDate: '2026-05-01T00:00:00Z',
      endDate: null
    })

    const callArgs = vi.mocked(recurringRuleService.create).mock.calls[0]
    expect(callArgs[0]).toBe('ws-aabbcc12')
    expect(callArgs[1].startDate).toBeInstanceOf(Date)
    expect(callArgs[1].endDate).toBeNull()
  })

  it('recurringRule:update → startDate 지정 시 Date 변환', () => {
    getHandler('recurringRule:update')({}, 'rule-aabbcc', { startDate: '2026-06-01T00:00:00Z' })

    const callArgs = vi.mocked(recurringRuleService.update).mock.calls[0]
    expect(callArgs[0]).toBe('rule-aabbcc')
    expect(callArgs[1].startDate).toBeInstanceOf(Date)
  })

  it('recurringRule:delete → ruleId 전달', () => {
    getHandler('recurringRule:delete')({}, 'rule-aabbcc')
    expect(recurringRuleService.delete).toHaveBeenCalledWith('rule-aabbcc')
  })
})
