/**
 * features/folder/manage-folder/ui/FolderNameDialog.test.tsx
 *
 * defaultValue로 초기화. 제출 시 onSubmit(name). 빈 이름 → 에러 메시지.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FolderNameDialog } from '../FolderNameDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: '새 폴더',
  submitLabel: '생성',
  onSubmit: vi.fn()
}

describe('FolderNameDialog', () => {
  it('title 노출 + 제출 라벨 노출', () => {
    render(<FolderNameDialog {...base} />)
    expect(screen.getByText('새 폴더')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument()
  })

  it('defaultValue → input value 초기화', () => {
    render(<FolderNameDialog {...base} defaultValue="원본 폴더" />)
    expect(screen.getByDisplayValue('원본 폴더')).toBeInTheDocument()
  })

  it('이름 입력 후 제출 → onSubmit("My Folder")', async () => {
    const onSubmit = vi.fn()
    render(<FolderNameDialog {...base} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('폴더 이름'), { target: { value: 'My Folder' } })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('My Folder'))
  })

  it('빈 이름 제출 → 에러 메시지', async () => {
    const onSubmit = vi.fn()
    render(<FolderNameDialog {...base} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    await waitFor(() => expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('취소 클릭 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<FolderNameDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('isPending=true → "생성 중..." 라벨 + disabled', () => {
    render(<FolderNameDialog {...base} isPending={true} />)
    const btn = screen.getByRole('button', { name: '생성 중...' })
    expect(btn).toBeDisabled()
  })
})
