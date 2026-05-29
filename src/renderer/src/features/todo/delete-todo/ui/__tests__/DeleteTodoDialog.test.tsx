/**
 * features/todo/delete-todo/ui/DeleteTodoDialog.test.tsx
 *
 * hasSubTodos true 시 "하위 할 일도 함께 이동" 문구 추가.
 * 삭제 클릭 → removeTodo mutate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRemoveTodo } from '@entities/todo'
import { DeleteTodoDialog } from '../DeleteTodoDialog'

vi.mock('@entities/todo', () => ({
  useRemoveTodo: vi.fn()
}))

const mutate = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRemoveTodo).mockReturnValue({ mutate } as unknown as ReturnType<
    typeof useRemoveTodo
  >)
})

const baseProps = {
  todoId: 't-1',
  workspaceId: 'ws-1',
  hasSubTodos: false,
  open: true,
  onOpenChange: vi.fn()
}

describe('DeleteTodoDialog', () => {
  it('hasSubTodos=false → 하위 할 일 문구 없음', () => {
    render(<DeleteTodoDialog {...baseProps} />)
    expect(screen.queryByText(/하위 할 일/)).not.toBeInTheDocument()
  })

  it('hasSubTodos=true → 하위 할 일 문구 노출', () => {
    render(<DeleteTodoDialog {...baseProps} hasSubTodos={true} />)
    expect(screen.getByText(/하위 할 일도 함께 이동/)).toBeInTheDocument()
  })

  it('삭제 클릭 → removeTodo({workspaceId, todoId}) mutate', () => {
    render(<DeleteTodoDialog {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(mutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', todoId: 't-1' }, expect.any(Object))
  })

  it('onDeleted 콜백 forwarding', () => {
    const onDeleted = vi.fn()
    mutate.mockImplementation((_args, opts: { onSuccess: () => void }) => opts.onSuccess())
    render(<DeleteTodoDialog {...baseProps} onDeleted={onDeleted} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDeleted).toHaveBeenCalled()
  })

  it('trigger 노드 제공 → AlertDialogTrigger 로 wrapping', () => {
    render(
      <DeleteTodoDialog
        {...baseProps}
        open={undefined as unknown as boolean}
        trigger={<button>Open dialog</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Open dialog' })).toBeInTheDocument()
  })
})
