/**
 * widgets/dashboard/ui/QuickActionsCard.test.tsx
 *
 * todoDialogTrigger / scheduleDialogTrigger 노출 + folder/calendar 버튼 → openTab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ openTab: vi.fn() }))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

import { QuickActionsCard } from '../QuickActionsCard'

beforeEach(() => {
  mocks.openTab.mockClear()
})

describe('QuickActionsCard', () => {
  it('todoDialog/scheduleDialog trigger 렌더', () => {
    render(
      <QuickActionsCard
        workspaceId="ws-1"
        todoDialogTrigger={<div data-testid="todo-trigger" />}
        scheduleDialogTrigger={<div data-testid="schedule-trigger" />}
      />
    )
    expect(screen.getByTestId('todo-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('schedule-trigger')).toBeInTheDocument()
  })

  it('"파일 탐색기" 클릭 → openTab(folder)', () => {
    render(
      <QuickActionsCard workspaceId="ws-1" todoDialogTrigger={null} scheduleDialogTrigger={null} />
    )
    fireEvent.click(screen.getByText('파일 탐색기'))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'folder' }))
  })

  it('"캘린더" 클릭 → openTab(calendar)', () => {
    render(
      <QuickActionsCard workspaceId="ws-1" todoDialogTrigger={null} scheduleDialogTrigger={null} />
    )
    fireEvent.click(screen.getByText('캘린더'))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'calendar' }))
  })
})
