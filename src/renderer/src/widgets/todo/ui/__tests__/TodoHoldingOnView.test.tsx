/**
 * widgets/todo/ui/TodoHoldingOnView.test.tsx
 *
 * 빈 todos + filterActive 분기. todos 있음 → 헤더 + HoldingOnRow.
 * 체크박스 클릭 → updateTodo({isDone:true}).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  updateMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: mocks.updateMutate }),
  TODO_STATUS: ['할일', '진행중', '완료', '보류'],
  TODO_PRIORITY: ['high', 'medium', 'low']
}))

vi.mock('@features/todo/delete-todo/ui/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-dialog" /> : null
}))

vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <span data-testid="entity-link" />,
  PanePickerSubmenu: ({
    children
  }: {
    children: (p: { onClick: () => void; isOpen: boolean }) => React.ReactNode
  }) => <>{children({ onClick: () => {}, isOpen: false })}</>
}))

vi.mock('@shared/ui/truncate-tooltip', () => ({
  TruncateTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { TodoHoldingOnView } from '../TodoHoldingOnView'

beforeEach(() => {
  mocks.updateMutate.mockReset()
})

describe('TodoHoldingOnView', () => {
  it('빈 + filterActive=false → "보류된 항목이 없습니다"', () => {
    render(
      <TodoHoldingOnView todos={[]} workspaceId="ws" filterActive={false} onItemClick={vi.fn()} />
    )
    expect(screen.getByText('보류된 항목이 없습니다')).toBeInTheDocument()
  })

  it('빈 + filterActive=true → "필터 조건에 맞는 보류 항목이 없습니다"', () => {
    render(
      <TodoHoldingOnView todos={[]} workspaceId="ws" filterActive={true} onItemClick={vi.fn()} />
    )
    expect(screen.getByText('필터 조건에 맞는 보류 항목이 없습니다')).toBeInTheDocument()
  })

  it('todos 있음 → 헤더 (제목/중요도/상태/마감일) + 행 노출', () => {
    render(
      <TodoHoldingOnView
        todos={
          [
            {
              id: 't1',
              title: 'Holding Task',
              status: '보류',
              priority: 'medium',
              isDone: false
            }
          ] as unknown as Parameters<typeof TodoHoldingOnView>[0]['todos']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('Holding Task')).toBeInTheDocument()
    expect(screen.getByText('제목')).toBeInTheDocument()
  })

  it('체크박스 클릭 → updateTodo.mutate({isDone:true})', () => {
    render(
      <TodoHoldingOnView
        todos={
          [
            {
              id: 't1',
              title: 'Task',
              status: '보류',
              priority: 'low',
              isDone: false
            }
          ] as unknown as Parameters<typeof TodoHoldingOnView>[0]['todos']
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
      data: { isDone: true }
    })
  })

  it('priority="high" → "높음" 라벨 노출', () => {
    render(
      <TodoHoldingOnView
        todos={
          [
            {
              id: 't1',
              title: 'High Task',
              status: '보류',
              priority: 'high',
              isDone: false
            }
          ] as unknown as Parameters<typeof TodoHoldingOnView>[0]['todos']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('높음')).toBeInTheDocument()
  })

  it('priority="low" → "낮음" 라벨 노출', () => {
    render(
      <TodoHoldingOnView
        todos={
          [
            {
              id: 't1',
              title: 'Low Task',
              status: '보류',
              priority: 'low',
              isDone: false
            }
          ] as unknown as Parameters<typeof TodoHoldingOnView>[0]['todos']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('낮음')).toBeInTheDocument()
  })

  it('제목 클릭 → onItemClick(todoId) 호출', () => {
    const onItemClick = vi.fn()
    render(
      <TodoHoldingOnView
        todos={
          [
            {
              id: 't-x',
              title: 'Click Me',
              status: '보류',
              priority: 'medium',
              isDone: false
            }
          ] as unknown as Parameters<typeof TodoHoldingOnView>[0]['todos']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={onItemClick}
      />
    )
    fireEvent.click(screen.getByText('Click Me'))
    expect(onItemClick).toHaveBeenCalledWith('t-x')
  })
})
