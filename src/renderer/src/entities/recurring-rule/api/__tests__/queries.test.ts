/**
 * entities/recurring-rule/api/queries.test.ts
 *
 * 5 hook: useRecurringRulesByWorkspace / useRecurringRulesToday / useCreate/Update/DeleteRecurringRule.
 * 주요 검증: ISO 문자열 → Date 재변환 (deserializeRule), workspace/today 동시 무효화.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useRecurringRulesByWorkspace,
  useRecurringRulesToday,
  useCreateRecurringRule,
  useUpdateRecurringRule,
  useDeleteRecurringRule,
  RECURRING_RULE_KEY
} from '../queries'
import type { RecurringRuleItem } from '../../model/types'

// Backend 가 직렬화한 형태 (Date → string). 타입 강제용 unknown 캐스트.
const RULE_RAW = {
  id: 'rule-1',
  workspaceId: 'ws-1',
  title: 'Daily',
  description: '',
  priority: 'medium',
  recurrenceType: 'daily',
  daysOfWeek: null,
  startTime: null,
  endTime: null,
  reminderOffsetMs: null,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as RecurringRuleItem

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    recurringRule: {
      findByWorkspace: vi.fn(),
      findToday: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
  vi.clearAllMocks()
})

function makeWrapper(): { wrapper: ({ children }: { children: ReactNode }) => ReactElement; qc: QueryClient } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

function api(): typeof window.api {
  return (window as unknown as { api: typeof window.api }).api
}

describe('useRecurringRulesByWorkspace', () => {
  it('성공 → 데이터 반환 + ISO 문자열을 Date 로 deserialize', async () => {
    vi.mocked(api().recurringRule.findByWorkspace).mockResolvedValue({
      success: true,
      data: [RULE_RAW]
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRecurringRulesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].startDate).toBeInstanceOf(Date)
    expect(result.current.data?.[0].createdAt).toBeInstanceOf(Date)
  })

  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useRecurringRulesByWorkspace(undefined), { wrapper })
    expect(api().recurringRule.findByWorkspace).not.toHaveBeenCalled()
  })
})

describe('useRecurringRulesToday', () => {
  it('성공 → date 인자로 findToday 호출', async () => {
    vi.mocked(api().recurringRule.findToday).mockResolvedValue({ success: true, data: [] })
    const { wrapper } = makeWrapper()
    const d = new Date('2026-05-29')
    renderHook(() => useRecurringRulesToday('ws-1', d), { wrapper })
    await waitFor(() => expect(api().recurringRule.findToday).toHaveBeenCalledWith('ws-1', d))
  })

  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useRecurringRulesToday(null, new Date()), { wrapper })
    expect(api().recurringRule.findToday).not.toHaveBeenCalled()
  })
})

describe('useCreateRecurringRule', () => {
  it('성공 → workspace + today 둘 다 무효화', async () => {
    vi.mocked(api().recurringRule.create).mockResolvedValue({ success: true, data: RULE_RAW })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateRecurringRule(), { wrapper })
    await act(async () => {
      result.current.mutate({
        workspaceId: 'ws-1',
        data: {
          title: 'x',
          recurrenceType: 'daily',
          startDate: new Date(),
          endDate: null,
          priority: 'medium',
          description: '',
          daysOfWeek: undefined,
          startTime: null,
          endTime: null,
          reminderOffsetMs: null
        }
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [RECURRING_RULE_KEY, 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [RECURRING_RULE_KEY, 'today', 'ws-1'] })
    // 결과 데이터도 Date 로 deserialize 됐는지
    expect(result.current.data?.startDate).toBeInstanceOf(Date)
  })
})

describe('useUpdateRecurringRule / useDeleteRecurringRule', () => {
  it('useUpdateRecurringRule → workspace + today 둘 다 무효화', async () => {
    vi.mocked(api().recurringRule.update).mockResolvedValue({ success: true, data: RULE_RAW })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateRecurringRule(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', ruleId: 'rule-1', data: {} })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [RECURRING_RULE_KEY, 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [RECURRING_RULE_KEY, 'today', 'ws-1'] })
  })

  it('useDeleteRecurringRule → 동일 두 키 무효화', async () => {
    vi.mocked(api().recurringRule.delete).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteRecurringRule(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', ruleId: 'rule-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [RECURRING_RULE_KEY, 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [RECURRING_RULE_KEY, 'today', 'ws-1'] })
  })
})
