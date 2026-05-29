/**
 * widgets/tag/ui/TagUpdateDialog.test.tsx
 *
 * tag 값으로 form 초기화. 변경된 필드만 onSubmit 에 포함.
 * 빈 description → null 로 전달.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../TagColorPicker', () => ({
  TagColorPicker: ({ value }: { value: string }) => <div data-testid="color">{value}</div>
}))

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadgePair: () => <span data-testid="author" />
}))

import { TagUpdateDialog } from '../TagUpdateDialog'

const tag = {
  id: 't1',
  name: '원본',
  color: '#ff0000',
  description: '원본 설명',
  createdBy: 'me',
  createdById: 'u1',
  createdAt: 0,
  updatedBy: 'me',
  updatedById: 'u1'
} as unknown as Parameters<typeof TagUpdateDialog>[0]['tag']

const base = {
  open: true,
  onOpenChange: vi.fn(),
  tag,
  onSubmit: vi.fn()
}

describe('TagUpdateDialog', () => {
  it('tag 값으로 form 초기화', () => {
    render(<TagUpdateDialog {...base} />)
    expect(screen.getByDisplayValue('원본')).toBeInTheDocument()
    expect(screen.getByTestId('color')).toHaveTextContent('#ff0000')
    expect(screen.getByDisplayValue('원본 설명')).toBeInTheDocument()
  })

  it('변경 없이 저장 → 빈 객체 onSubmit', async () => {
    const onSubmit = vi.fn()
    render(<TagUpdateDialog {...base} onSubmit={onSubmit} />)
    const buttons = screen.getAllByRole('button')
    const submitBtn = buttons.find((b) => b.textContent !== '취소')!
    fireEvent.click(submitBtn)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}))
  })

  it('name 변경 → onSubmit({name})', async () => {
    const onSubmit = vi.fn()
    render(<TagUpdateDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByDisplayValue('원본'), { target: { value: '변경됨' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent !== '취소')!
    fireEvent.click(submitBtn)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: '변경됨' }))
  })

  it('description 비우기 → onSubmit({description: null})', async () => {
    const onSubmit = vi.fn()
    render(<TagUpdateDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByDisplayValue('원본 설명'), { target: { value: '' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent !== '취소')!
    fireEvent.click(submitBtn)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ description: null }))
  })

  it('빈 name → 에러', async () => {
    const onSubmit = vi.fn()
    render(<TagUpdateDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByDisplayValue('원본'), { target: { value: '' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent !== '취소')!
    fireEvent.click(submitBtn)
    await waitFor(() => expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
