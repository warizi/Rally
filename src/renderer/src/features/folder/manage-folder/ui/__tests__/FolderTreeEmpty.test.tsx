/**
 * FolderTreeEmpty 단위 테스트 (P1-3 follow-up).
 *
 * 빈 상태 안내 UI 의 3개 quick-action 버튼이 콜백을 호출하는지 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FolderTreeEmpty } from '../FolderTreeEmpty'

describe('FolderTreeEmpty', () => {
  it('renders title and description', () => {
    render(
      <FolderTreeEmpty onCreateNote={vi.fn()} onCreateCsv={vi.fn()} onCreateFolder={vi.fn()} />
    )
    expect(screen.getByText('첫 노트를 만들어보세요')).toBeInTheDocument()
    expect(screen.getByText('노트, 표, 폴더로 시작하세요.')).toBeInTheDocument()
  })

  it('노트 button click calls onCreateNote', () => {
    const onCreateNote = vi.fn()
    render(
      <FolderTreeEmpty onCreateNote={onCreateNote} onCreateCsv={vi.fn()} onCreateFolder={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /노트/ }))
    expect(onCreateNote).toHaveBeenCalledTimes(1)
  })

  it('표 button click calls onCreateCsv', () => {
    const onCreateCsv = vi.fn()
    render(
      <FolderTreeEmpty onCreateNote={vi.fn()} onCreateCsv={onCreateCsv} onCreateFolder={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /표/ }))
    expect(onCreateCsv).toHaveBeenCalledTimes(1)
  })

  it('폴더 button click calls onCreateFolder', () => {
    const onCreateFolder = vi.fn()
    render(
      <FolderTreeEmpty
        onCreateNote={vi.fn()}
        onCreateCsv={vi.fn()}
        onCreateFolder={onCreateFolder}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /폴더/ }))
    expect(onCreateFolder).toHaveBeenCalledTimes(1)
  })
})
