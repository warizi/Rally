/**
 * features/canvas/create-canvas/ui/CreateCanvasDialog.test.tsx
 *
 * title 필수 + description 옵셔널. 빈 description → undefined 전달.
 * open 변경 시 form reset.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateCanvasDialog } from '../CreateCanvasDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  onSubmit: vi.fn()
}

describe('CreateCanvasDialog', () => {
  it('타이틀 + 필드 라벨 노출', () => {
    render(<CreateCanvasDialog {...base} />)
    expect(screen.getByText('새 캔버스')).toBeInTheDocument()
    expect(screen.getByText('이름')).toBeInTheDocument()
    expect(screen.getByText('설명 (선택)')).toBeInTheDocument()
  })

  it('이름 + 설명 입력 후 생성 → onSubmit({title, description})', async () => {
    const onSubmit = vi.fn()
    render(<CreateCanvasDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('캔버스 이름'), {
      target: { value: 'My Canvas' }
    })
    fireEvent.change(screen.getByPlaceholderText('캔버스에 대한 설명'), {
      target: { value: 'desc' }
    })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: 'My Canvas', description: 'desc' })
    )
  })

  it('설명 비우면 description=undefined', async () => {
    const onSubmit = vi.fn()
    render(<CreateCanvasDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('캔버스 이름'), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: 'A', description: undefined })
    )
  })

  it('빈 이름 제출 → 에러 메시지', async () => {
    const onSubmit = vi.fn()
    render(<CreateCanvasDialog {...base} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() => expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<CreateCanvasDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('isPending=true → "생성 중..." disabled', () => {
    render(<CreateCanvasDialog {...base} isPending={true} />)
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
  })
})
