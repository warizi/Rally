/**
 * FolderTreeToolbar 단위 테스트 (P1-3 follow-up).
 *
 * 각 버튼/메뉴 클릭이 올바른 콜백을 호출하는지 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TooltipProvider } from '@shared/ui/tooltip'
import { FolderTreeToolbar } from '../FolderTreeToolbar'
import type { FolderCreateHandlers } from '../../model/use-folder-create-handlers'

function makeHandlers(): FolderCreateHandlers {
  return {
    handleCreateNote: vi.fn(),
    handleCreateCsv: vi.fn(),
    handleImportNote: vi.fn(),
    handleImportCsv: vi.fn(),
    handleImportPdf: vi.fn(),
    handleImportImage: vi.fn()
  } as unknown as FolderCreateHandlers
}

interface RenderOverrides {
  createHandlers?: FolderCreateHandlers
  onCollapseAll?: () => void
  onCreateFolder?: () => void
  onToggleSearch?: () => void
}

function renderToolbar(overrides: RenderOverrides = {}): {
  createHandlers: FolderCreateHandlers
  onCollapseAll: () => void
  onCreateFolder: () => void
  onToggleSearch: () => void
} {
  const createHandlers = overrides.createHandlers ?? makeHandlers()
  const onCollapseAll = overrides.onCollapseAll ?? vi.fn()
  const onCreateFolder = overrides.onCreateFolder ?? vi.fn()
  const onToggleSearch = overrides.onToggleSearch ?? vi.fn()

  render(
    <TooltipProvider>
      <FolderTreeToolbar
        createHandlers={createHandlers}
        onCollapseAll={onCollapseAll}
        onCreateFolder={onCreateFolder}
        onToggleSearch={onToggleSearch}
      />
    </TooltipProvider>
  )

  return { createHandlers, onCollapseAll, onCreateFolder, onToggleSearch }
}

describe('FolderTreeToolbar', () => {
  it('renders 탐색기 label', () => {
    renderToolbar()
    expect(screen.getByText('탐색기')).toBeInTheDocument()
  })

  // 버튼 순서: 검색(0), 모두 접기(1), 노트 dropdown(2), 테이블 dropdown(3), PDF(4), 이미지(5), 폴더 추가(6)
  it('"검색" button click calls onToggleSearch', () => {
    const { onToggleSearch } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onToggleSearch).toHaveBeenCalledTimes(1)
  })

  it('"모두 접기" button click calls onCollapseAll', () => {
    const { onCollapseAll } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    expect(onCollapseAll).toHaveBeenCalledTimes(1)
  })

  it('PDF import button click calls handleImportPdf(null)', () => {
    const { createHandlers } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[4])
    expect(createHandlers.handleImportPdf).toHaveBeenCalledWith(null)
  })

  it('이미지 import button click calls handleImportImage(null)', () => {
    const { createHandlers } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[5])
    expect(createHandlers.handleImportImage).toHaveBeenCalledWith(null)
  })

  it('폴더 추가 button click calls onCreateFolder', () => {
    const { onCreateFolder } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[6])
    expect(onCreateFolder).toHaveBeenCalledTimes(1)
  })

  it('총 7개 버튼 노출 (검색/접기/노트/테이블/PDF/이미지/폴더)', () => {
    renderToolbar()
    expect(screen.getAllByRole('button').length).toBe(7)
  })

  it('createHandlers prop 전달 시 mutations 즉시 호출 안 됨', () => {
    const { createHandlers } = renderToolbar()
    expect(createHandlers.handleCreateNote).not.toHaveBeenCalled()
    expect(createHandlers.handleCreateCsv).not.toHaveBeenCalled()
    expect(createHandlers.handleImportNote).not.toHaveBeenCalled()
  })
})
