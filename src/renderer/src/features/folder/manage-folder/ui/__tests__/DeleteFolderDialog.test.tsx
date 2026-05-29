/**
 * features/folder/manage-folder/ui/DeleteFolderDialog.test.tsx
 *
 * 폴더 이름 노출 + 삭제 클릭 시 onConfirm. isPending 시 버튼 disabled + 문구 변경.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteFolderDialog } from '../DeleteFolderDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  folderName: 'My Folder',
  onConfirm: vi.fn()
}

describe('DeleteFolderDialog', () => {
  it('open=true → 폴더 이름 노출', () => {
    render(<DeleteFolderDialog {...base} />)
    expect(screen.getByText('"My Folder"')).toBeInTheDocument()
  })

  it('삭제 클릭 → onConfirm 호출', () => {
    const fn = vi.fn()
    render(<DeleteFolderDialog {...base} onConfirm={fn} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(fn).toHaveBeenCalled()
  })

  it('isPending=true → "삭제 중..." 라벨 + disabled', () => {
    render(<DeleteFolderDialog {...base} isPending={true} />)
    const btn = screen.getByRole('button', { name: '삭제 중...' })
    expect(btn).toBeDisabled()
  })

  it('open=false → 콘텐츠 미렌더', () => {
    render(<DeleteFolderDialog {...base} open={false} />)
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })
})
