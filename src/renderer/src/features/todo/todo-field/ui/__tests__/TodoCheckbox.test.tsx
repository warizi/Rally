/**
 * features/todo/todo-field/ui/TodoCheckbox.test.tsx
 *
 * checked → checkbox state. 토글 → useUpdateTodo.mutate({isDone}) + 완료 + title 있으면 toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: mocks.mutate })
}))
vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess }
}))

import { TodoCheckbox } from '../TodoCheckbox'

beforeEach(() => {
  mocks.mutate.mockReset()
  mocks.toastSuccess.mockReset()
})

describe('TodoCheckbox', () => {
  it('checked=true → checkbox state=checked', () => {
    render(<TodoCheckbox todoId="t1" workspaceId="ws" checked={true} />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked')
  })

  it('checked=false → unchecked', () => {
    render(<TodoCheckbox todoId="t1" workspaceId="ws" checked={false} />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'unchecked')
  })

  it('클릭 → mutate({isDone:true}), title 있음 → toast.success', () => {
    mocks.mutate.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(<TodoCheckbox todoId="t1" workspaceId="ws" checked={false} title="My Task" />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mocks.mutate).toHaveBeenCalledWith(
      { workspaceId: 'ws', todoId: 't1', data: { isDone: true } },
      expect.any(Object)
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('"My Task" 완료!')
  })

  it('title 없으면 → toast 호출 안 함', () => {
    mocks.mutate.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(<TodoCheckbox todoId="t1" workspaceId="ws" checked={false} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('checked=true 상태에서 해제 → toast 호출 안 함 (value=false)', () => {
    mocks.mutate.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(<TodoCheckbox todoId="t1" workspaceId="ws" checked={true} title="X" />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })
})
