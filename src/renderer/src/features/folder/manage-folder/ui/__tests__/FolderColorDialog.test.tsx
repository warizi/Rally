/**
 * features/folder/manage-folder/ui/FolderColorDialog.test.tsx
 *
 * 색상 선택 후 적용 → onSubmit. 취소 → onOpenChange(false). isPending 시 버튼 disabled.
 * open=true 시 currentColor로 selected 초기화.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FolderColorDialog } from '../FolderColorDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  currentColor: null as string | null,
  onSubmit: vi.fn()
}

describe('FolderColorDialog', () => {
  it('open=true → 색상 그리드 노출 (14개 옵션)', () => {
    render(<FolderColorDialog {...base} />)
    expect(screen.getByTitle('기본')).toBeInTheDocument()
    expect(screen.getByTitle('빨강')).toBeInTheDocument()
    expect(screen.getByTitle('회색')).toBeInTheDocument()
  })

  it('색상 클릭 → 적용 클릭 → onSubmit(선택된 색)', () => {
    const onSubmit = vi.fn()
    render(<FolderColorDialog {...base} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByTitle('빨강'))
    fireEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onSubmit).toHaveBeenCalledWith('#ffb3b3')
  })

  it('취소 클릭 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<FolderColorDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('isPending=true → "적용 중..." 라벨 + disabled', () => {
    render(<FolderColorDialog {...base} isPending={true} />)
    const btn = screen.getByRole('button', { name: '적용 중...' })
    expect(btn).toBeDisabled()
  })

  it('currentColor 가 있으면 초기 선택 상태 유지 후 onSubmit', () => {
    const onSubmit = vi.fn()
    render(<FolderColorDialog {...base} currentColor="#ffd1a3" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onSubmit).toHaveBeenCalledWith('#ffd1a3')
  })

  it('open=false → 콘텐츠 미렌더', () => {
    render(<FolderColorDialog {...base} open={false} />)
    expect(screen.queryByRole('button', { name: '적용' })).not.toBeInTheDocument()
  })
})
