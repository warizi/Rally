/**
 * widgets/todo/ui/EditSubTodoDialog.test.tsx
 *
 * currentTitle 로 초기화. 저장 → updateTodo.mutate({title}) + onSuccess → onOpenChange(false).
 * 빈 제목 → 에러 메시지.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: mocks.mutate, isPending: mocks.isPending })
}))

import { EditSubTodoDialog } from '../EditSubTodoDialog'

const base = {
  todoId: 't1',
  workspaceId: 'ws',
  currentTitle: '원본',
  open: true,
  onOpenChange: vi.fn()
}

beforeEach(() => {
  mocks.mutate.mockReset()
  mocks.isPending = false
})

describe('EditSubTodoDialog', () => {
  it('currentTitle → input value 초기화', () => {
    render(<EditSubTodoDialog {...base} />)
    expect(screen.getByDisplayValue('원본')).toBeInTheDocument()
  })

  it('수정 후 저장 → mutate({title 변경값}) + onSuccess → onOpenChange(false)', async () => {
    const onOpenChange = vi.fn()
    mocks.mutate.mockImplementation((_arg, opts) => {
      opts?.onSuccess?.()
    })
    render(<EditSubTodoDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.change(screen.getByPlaceholderText('제목을 입력하세요'), {
      target: { value: '변경됨' }
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        { workspaceId: 'ws', todoId: 't1', data: { title: '변경됨' } },
        expect.any(Object)
      )
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('빈 제목 → 에러 메시지', async () => {
    render(<EditSubTodoDialog {...base} currentTitle="" />)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.getByText('제목을 입력하세요')).toBeInTheDocument())
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<EditSubTodoDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('isPending=true → 저장 버튼 disabled', () => {
    mocks.isPending = true
    render(<EditSubTodoDialog {...base} />)
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })
})
