/**
 * widgets/todo/ui/RecurringTodoView.test.tsx
 *
 * 빈 rules → "오늘 반복 할일이 없습니다" / 채움 → 각 룰 행 렌더 + Checkbox 토글.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TooltipProvider } from '@shared/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import type { RenderResult } from '@testing-library/react'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

const mocks = vi.hoisted(() => ({
  completeMutate: vi.fn(),
  uncompleteMutate: vi.fn()
}))

vi.mock('@entities/recurring-completion', () => ({
  useCompleteRecurring: () => ({ mutate: mocks.completeMutate })
}))
vi.mock('@/widgets/recurring', () => ({
  useUncompleteRecurring: () => ({ mutate: mocks.uncompleteMutate })
}))

import { RecurringTodoView } from '../RecurringTodoView'
import type { RecurringRuleItem } from '@entities/recurring-rule'
import type { RecurringCompletionItem } from '@entities/recurring-completion'

function rule(id: string, overrides?: Partial<RecurringRuleItem>): RecurringRuleItem {
  return {
    id,
    title: `Rule ${id}`,
    priority: 'medium',
    startTime: null,
    endTime: null,
    updatedAt: new Date(),
    updatedBy: 'user',
    updatedById: null,
    ...overrides
  } as unknown as RecurringRuleItem
}

function completion(ruleId: string): RecurringCompletionItem {
  return { id: `c-${ruleId}`, ruleId } as unknown as RecurringCompletionItem
}

beforeEach(() => {
  mocks.completeMutate.mockClear()
  mocks.uncompleteMutate.mockClear()
})

const DATE = new Date('2026-05-29')

describe('RecurringTodoView', () => {
  it('rules 0개 → empty 메시지', () => {
    r(<RecurringTodoView rules={[]} completions={[]} workspaceId="ws-1" date={DATE} />)
    expect(screen.getByText('오늘 반복 할일이 없습니다')).toBeInTheDocument()
  })

  it('rules N개 → 각 룰 제목 노출', () => {
    r(
      <RecurringTodoView
        rules={[rule('a'), rule('b')]}
        completions={[]}
        workspaceId="ws-1"
        date={DATE}
      />
    )
    expect(screen.getByText('Rule a')).toBeInTheDocument()
    expect(screen.getByText('Rule b')).toBeInTheDocument()
  })

  it('미완료 → 체크 시 completeRecurring 호출', () => {
    r(<RecurringTodoView rules={[rule('a')]} completions={[]} workspaceId="ws-1" date={DATE} />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(mocks.completeMutate).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      ruleId: 'a',
      date: DATE
    })
  })

  it('완료된 룰 → 체크 해제 시 uncompleteRecurring 호출', () => {
    r(
      <RecurringTodoView
        rules={[rule('a')]}
        completions={[completion('a')]}
        workspaceId="ws-1"
        date={DATE}
      />
    )
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('data-state', 'checked')
    fireEvent.click(checkbox)
    expect(mocks.uncompleteMutate).toHaveBeenCalledWith(
      expect.objectContaining({ completionId: 'c-a', workspaceId: 'ws-1' })
    )
  })

  it('startTime/endTime 있으면 시간 표시', () => {
    r(
      <RecurringTodoView
        rules={[rule('a', { startTime: '09:00', endTime: '10:00' })]}
        completions={[]}
        workspaceId="ws-1"
        date={DATE}
      />
    )
    expect(screen.getByText('09:00~10:00')).toBeInTheDocument()
  })
})
