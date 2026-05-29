/**
 * features/folder/manage-folder/ui/FileContextMenu.test.tsx
 *
 * name 라벨 + 복사/삭제 → 콜백 호출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  ContextMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuSeparator: () => <hr />,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

import { FileContextMenu } from '../FileContextMenu'

describe('FileContextMenu', () => {
  it('name 노출 + 복사/삭제 버튼', () => {
    render(
      <FileContextMenu name="memo.md" kind="note" onDuplicate={vi.fn()} onDelete={vi.fn()}>
        <div />
      </FileContextMenu>
    )
    expect(screen.getByText('memo.md')).toBeInTheDocument()
    expect(screen.getByText('복사')).toBeInTheDocument()
    expect(screen.getByText('삭제')).toBeInTheDocument()
  })

  it('복사 → onDuplicate', () => {
    const fn = vi.fn()
    render(
      <FileContextMenu name="x" kind="csv" onDuplicate={fn} onDelete={vi.fn()}>
        <div />
      </FileContextMenu>
    )
    fireEvent.click(screen.getByText('복사'))
    expect(fn).toHaveBeenCalled()
  })

  it('삭제 → onDelete', () => {
    const fn = vi.fn()
    render(
      <FileContextMenu name="x" kind="pdf" onDuplicate={vi.fn()} onDelete={fn}>
        <div />
      </FileContextMenu>
    )
    fireEvent.click(screen.getByText('삭제'))
    expect(fn).toHaveBeenCalled()
  })

  it('kind=image — 노출만 검증 (icon 분기)', () => {
    render(
      <FileContextMenu name="img.png" kind="image" onDuplicate={vi.fn()} onDelete={vi.fn()}>
        <div />
      </FileContextMenu>
    )
    expect(screen.getByText('img.png')).toBeInTheDocument()
  })
})
