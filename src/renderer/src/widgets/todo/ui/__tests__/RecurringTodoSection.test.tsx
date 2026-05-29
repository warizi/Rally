/**
 * widgets/todo/ui/RecurringTodoSection.test.tsx
 *
 * rules/completions hook + 관리 버튼 클릭 → ManageRecurringDialog 노출.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  rules: [] as Array<{ id: string }>,
  completions: [] as Array<{ id: string }>
}))

vi.mock('@entities/recurring-rule', () => ({
  useRecurringRulesToday: () => ({ data: mocks.rules })
}))
vi.mock('@entities/recurring-completion', () => ({
  useRecurringCompletionsToday: () => ({ data: mocks.completions }),
  useCompleteRecurring: () => ({ mutate: vi.fn() })
}))
vi.mock('../RecurringTodoView', () => ({
  RecurringTodoView: () => <div data-testid="recurring-view" />
}))
vi.mock('@features/todo/manage-recurring/ui/ManageRecurringDialog', () => ({
  ManageRecurringDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="manage-dialog" /> : null
}))

import { RecurringTodoSection } from '../RecurringTodoSection'

beforeEach(() => {
  mocks.rules = []
  mocks.completions = []
})

describe('RecurringTodoSection', () => {
  it('rules 개수가 타이틀에 표시', () => {
    mocks.rules = [{ id: 'r1' }, { id: 'r2' }]
    render(<RecurringTodoSection workspaceId="ws-1" date={new Date()} open={true} />)
    expect(screen.getByText('반복 할일 (2개)')).toBeInTheDocument()
  })

  it('RecurringTodoView 자식 렌더', () => {
    render(<RecurringTodoSection workspaceId="ws-1" date={new Date()} open={true} />)
    expect(screen.getByTestId('recurring-view')).toBeInTheDocument()
  })

  it('관리 버튼 클릭 → ManageRecurringDialog 노출', () => {
    render(<RecurringTodoSection workspaceId="ws-1" date={new Date()} open={true} />)
    expect(screen.queryByTestId('manage-dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /관리/ }))
    expect(screen.getByTestId('manage-dialog')).toBeInTheDocument()
  })
})
