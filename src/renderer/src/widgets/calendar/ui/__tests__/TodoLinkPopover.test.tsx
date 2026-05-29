/**
 * widgets/calendar/ui/TodoLinkPopover.test.tsx
 *
 * trigger 클릭 → popover 열림 + 할일 목록 + 검색 / 이미 링크된 항목은 disabled.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  todos: [] as Array<{ id: string; title: string }>,
  linkMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos })
}))
vi.mock('../../model/use-linked-todos', () => ({
  useLinkTodo: () => ({ mutate: mocks.linkMutate })
}))

import { TodoLinkPopover } from '../TodoLinkPopover'

beforeEach(() => {
  mocks.todos = []
  mocks.linkMutate.mockClear()
})

function renderPopover(linkedTodoIds: string[] = []): ReturnType<typeof render> {
  return render(
    <TodoLinkPopover scheduleId="sch-1" workspaceId="ws-1" linkedTodoIds={linkedTodoIds}>
      <button>Open</button>
    </TodoLinkPopover>
  )
}

describe('TodoLinkPopover', () => {
  it('trigger children 렌더', () => {
    renderPopover()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('trigger 클릭 → popover 열림 + 할일 목록', () => {
    mocks.todos = [
      { id: 't1', title: '할일 A' },
      { id: 't2', title: '할일 B' }
    ]
    renderPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByText('할일 A')).toBeInTheDocument()
    expect(screen.getByText('할일 B')).toBeInTheDocument()
  })

  it('할일 0개 → "할 일이 없습니다"', () => {
    renderPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByText('할 일이 없습니다')).toBeInTheDocument()
  })

  it('검색 입력 → filter 적용', () => {
    mocks.todos = [
      { id: 't1', title: 'Apple' },
      { id: 't2', title: 'Banana' }
    ]
    renderPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(screen.getByPlaceholderText('할 일 검색...'), { target: { value: 'ban' } })
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
  })

  it('할일 클릭 → linkTodo.mutate 호출', () => {
    mocks.todos = [{ id: 't1', title: 'X' }]
    renderPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByText('X'))
    expect(mocks.linkMutate).toHaveBeenCalledWith({ scheduleId: 'sch-1', todoId: 't1' })
  })

  it('이미 연결된 todo → disabled + 클릭해도 mutate 안 함', () => {
    mocks.todos = [{ id: 't1', title: '이미 연결됨' }]
    renderPopover(['t1'])
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const todoBtn = screen.getByText('이미 연결됨').closest('button')!
    expect(todoBtn).toBeDisabled()
    fireEvent.click(todoBtn)
    expect(mocks.linkMutate).not.toHaveBeenCalled()
  })
})
