/**
 * widgets/todo/ui/TodoCompletedView.test.tsx
 *
 * 빈 items → "완료된 항목이 없습니다" / filterActive 분기.
 * todo type → TodoCompletedRow + 체크박스 클릭 → updateTodo({isDone:false}).
 * recurring type → RecurringCompletedRow + 체크 → uncompleteRecurring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  uncompleteMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: mocks.updateMutate })
}))

vi.mock('@/widgets/recurring', () => ({
  useUncompleteRecurring: () => ({ mutate: mocks.uncompleteMutate })
}))

vi.mock('@features/todo/delete-todo/ui/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-dialog" /> : null
}))

vi.mock('@/widgets/entity-link', () => ({
  PanePickerSubmenu: ({
    children
  }: {
    children: (p: { onClick: () => void; isOpen: boolean }) => React.ReactNode
  }) => <>{children({ onClick: () => {}, isOpen: false })}</>
}))

vi.mock('@shared/ui/truncate-tooltip', () => ({
  TruncateTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { TodoCompletedView } from '../TodoCompletedView'

beforeEach(() => {
  mocks.updateMutate.mockReset()
  mocks.uncompleteMutate.mockReset()
})

describe('TodoCompletedView', () => {
  it('빈 items + filterActive=false → "완료된 항목이 없습니다"', () => {
    render(
      <TodoCompletedView items={[]} workspaceId="ws" filterActive={false} onItemClick={vi.fn()} />
    )
    expect(screen.getByText('완료된 항목이 없습니다')).toBeInTheDocument()
  })

  it('빈 items + filterActive=true → "필터 조건에 맞는 완료 항목이 없습니다"', () => {
    render(
      <TodoCompletedView items={[]} workspaceId="ws" filterActive={true} onItemClick={vi.fn()} />
    )
    expect(screen.getByText('필터 조건에 맞는 완료 항목이 없습니다')).toBeInTheDocument()
  })

  it('todo type 항목 → 제목 노출 + 헤더 노출 + 클릭 시 onItemClick', () => {
    const onItemClick = vi.fn()
    const todo = {
      id: 't1',
      title: 'Done Task',
      isDone: true,
      priority: 'high',
      doneAt: new Date('2026-05-29')
    }
    render(
      <TodoCompletedView
        items={
          [{ type: 'todo', todo }] as unknown as Parameters<typeof TodoCompletedView>[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={onItemClick}
      />
    )
    expect(screen.getByText('Done Task')).toBeInTheDocument()
    expect(screen.getByText('제목')).toBeInTheDocument()
  })

  it('todo type 체크박스 클릭 → updateTodo.mutate({isDone:false})', () => {
    const todo = { id: 't1', title: 'Task', isDone: true, priority: 'medium', doneAt: new Date() }
    render(
      <TodoCompletedView
        items={
          [{ type: 'todo', todo }] as unknown as Parameters<typeof TodoCompletedView>[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mocks.updateMutate).toHaveBeenCalledWith({
      workspaceId: 'ws',
      todoId: 't1',
      data: { isDone: false }
    })
  })

  it('recurring type → RecurringCompletedRow + 제목 노출', () => {
    const rc = {
      id: 'rc1',
      ruleId: 'r1',
      ruleTitle: 'Recurring Task',
      completedAt: new Date('2026-05-29')
    }
    render(
      <TodoCompletedView
        items={
          [{ type: 'recurring', recurringCompletion: rc }] as unknown as Parameters<
            typeof TodoCompletedView
          >[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('Recurring Task')).toBeInTheDocument()
  })

  it('recurring 체크박스 → uncompleteRecurring.mutate', () => {
    const rc = {
      id: 'rc1',
      ruleId: 'r1',
      ruleTitle: 'X',
      completedAt: new Date()
    }
    render(
      <TodoCompletedView
        items={
          [{ type: 'recurring', recurringCompletion: rc }] as unknown as Parameters<
            typeof TodoCompletedView
          >[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mocks.uncompleteMutate).toHaveBeenCalled()
  })

  it('여러 todo 항목 → 모두 행 노출', () => {
    render(
      <TodoCompletedView
        items={
          [
            {
              type: 'todo',
              todo: { id: 't1', title: 'Done 1', priority: 'high', isDone: true }
            },
            {
              type: 'todo',
              todo: { id: 't2', title: 'Done 2', priority: 'low', isDone: true }
            }
          ] as unknown as Parameters<typeof TodoCompletedView>[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('Done 1')).toBeInTheDocument()
    expect(screen.getByText('Done 2')).toBeInTheDocument()
  })

  it('todo type + 제목 클릭 → onItemClick(todoId) 호출', () => {
    const onItemClick = vi.fn()
    render(
      <TodoCompletedView
        items={
          [
            {
              type: 'todo',
              todo: { id: 't-x', title: 'Click', priority: 'medium', isDone: true }
            }
          ] as unknown as Parameters<typeof TodoCompletedView>[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={onItemClick}
      />
    )
    fireEvent.click(screen.getByText('Click'))
    expect(onItemClick).toHaveBeenCalledWith('t-x')
  })
})
