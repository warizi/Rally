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
}

function renderToolbar(overrides: RenderOverrides = {}): {
  createHandlers: FolderCreateHandlers
  onCollapseAll: () => void
  onCreateFolder: () => void
} {
  const createHandlers = overrides.createHandlers ?? makeHandlers()
  const onCollapseAll = overrides.onCollapseAll ?? vi.fn()
  const onCreateFolder = overrides.onCreateFolder ?? vi.fn()

  render(
    <TooltipProvider>
      <FolderTreeToolbar
        createHandlers={createHandlers}
        onCollapseAll={onCollapseAll}
        onCreateFolder={onCreateFolder}
      />
    </TooltipProvider>
  )

  return { createHandlers, onCollapseAll, onCreateFolder }
}

describe('FolderTreeToolbar', () => {
  it('renders 탐색기 label', () => {
    renderToolbar()
    expect(screen.getByText('탐색기')).toBeInTheDocument()
  })

  it('"모두 접기" button click calls onCollapseAll', () => {
    const { onCollapseAll } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onCollapseAll).toHaveBeenCalledTimes(1)
  })

  it('PDF import button click calls handleImportPdf(null)', () => {
    const { createHandlers } = renderToolbar()
    // PDF는 dropdown 없이 직접 버튼 — 4번째 ghost icon (모두 접기, 노트 dropdown, 테이블 dropdown, PDF)
    const buttons = screen.getAllByRole('button')
    // 모두 접기(0), 노트 dropdown trigger(1), 테이블 dropdown trigger(2), PDF(3), 이미지(4), 폴더 추가(5)
    fireEvent.click(buttons[3])
    expect(createHandlers.handleImportPdf).toHaveBeenCalledWith(null)
  })

  it('이미지 import button click calls handleImportImage(null)', () => {
    const { createHandlers } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[4])
    expect(createHandlers.handleImportImage).toHaveBeenCalledWith(null)
  })

  it('폴더 추가 button click calls onCreateFolder', () => {
    const { onCreateFolder } = renderToolbar()
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[5])
    expect(onCreateFolder).toHaveBeenCalledTimes(1)
  })
})
