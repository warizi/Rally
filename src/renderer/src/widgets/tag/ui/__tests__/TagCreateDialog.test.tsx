/**
 * widgets/tag/ui/TagCreateDialog.test.tsx
 *
 * name 입력 후 생성 → onSubmit({name, color, [description]}).
 * 빈 name → 에러. isPending → disabled.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../TagColorPicker', () => ({
  TagColorPicker: ({ value }: { value: string }) => <div data-testid="color">{value}</div>
}))

import { TagCreateDialog } from '../TagCreateDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  onSubmit: vi.fn()
}

describe('TagCreateDialog', () => {
  it('타이틀 + name placeholder + 기본 color', () => {
    render(<TagCreateDialog {...base} />)
    expect(screen.getByText('새 태그')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('태그 이름')).toBeInTheDocument()
    expect(screen.getByTestId('color')).toHaveTextContent('#a3c4f5')
  })

  it('name 입력 + 생성 → onSubmit({name, color})', async () => {
    const onSubmit = vi.fn()
    render(<TagCreateDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: 'tag1' } })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'tag1', color: '#a3c4f5' }))
  })

  it('description 입력 → onSubmit 포함', async () => {
    const onSubmit = vi.fn()
    render(<TagCreateDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('태그 이름'), { target: { value: 'tag1' } })
    fireEvent.change(screen.getByPlaceholderText('태그 설명'), { target: { value: 'desc' } })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'tag1',
        color: '#a3c4f5',
        description: 'desc'
      })
    )
  })

  it('빈 name → 에러 메시지', async () => {
    render(<TagCreateDialog {...base} />)
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() => expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument())
  })

  it('isPending → "생성 중..." disabled', () => {
    render(<TagCreateDialog {...base} isPending />)
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<TagCreateDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
