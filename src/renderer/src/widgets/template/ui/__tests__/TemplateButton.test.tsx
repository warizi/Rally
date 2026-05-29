/**
 * widgets/template/ui/TemplateButton.test.tsx
 *
 * 트리거 클릭 → popover. 저장 클릭: data 비어있음 → emptyAlert / data 있음 → SaveDialog.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, type RenderResult } from '@testing-library/react'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

vi.mock('../SaveTemplateDialog', () => ({
  SaveTemplateDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="save-dialog" /> : null
}))
vi.mock('../LoadTemplateDialog', () => ({
  LoadTemplateDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="load-dialog" /> : null
}))

import { TemplateButton } from '../TemplateButton'

function r(ui: ReactElement): RenderResult {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('TemplateButton', () => {
  it('FileStack 트리거 버튼 노출', () => {
    const { container } = r(
      <TemplateButton
        workspaceId="ws-1"
        type="note"
        getJsonData={() => null}
        hasContent={false}
        onApply={vi.fn()}
      />
    )
    expect(container.querySelector('svg.lucide-file-stack')).toBeInTheDocument()
  })

  it('트리거 클릭 → popover 열림 + "현재 구성 저장" / "템플릿 불러오기" 노출', () => {
    r(
      <TemplateButton
        workspaceId="ws-1"
        type="note"
        getJsonData={() => null}
        hasContent={false}
        onApply={vi.fn()}
      />
    )
    // popover trigger 클릭
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('현재 구성 저장')).toBeInTheDocument()
    expect(screen.getByText('템플릿 불러오기')).toBeInTheDocument()
  })

  it('"현재 구성 저장" 클릭 + data null → emptyAlert', () => {
    r(
      <TemplateButton
        workspaceId="ws-1"
        type="note"
        getJsonData={() => null}
        hasContent={false}
        onApply={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('현재 구성 저장'))
    expect(screen.getByText('저장할 내용이 비어있습니다')).toBeInTheDocument()
  })

  it('"현재 구성 저장" 클릭 + data 있음 → SaveDialog 노출', () => {
    r(
      <TemplateButton
        workspaceId="ws-1"
        type="note"
        getJsonData={() => 'content'}
        hasContent={true}
        onApply={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('현재 구성 저장'))
    expect(screen.getByTestId('save-dialog')).toBeInTheDocument()
  })

  it('"템플릿 불러오기" 클릭 → LoadDialog 노출', () => {
    r(
      <TemplateButton
        workspaceId="ws-1"
        type="note"
        getJsonData={() => null}
        hasContent={false}
        onApply={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('템플릿 불러오기'))
    expect(screen.getByTestId('load-dialog')).toBeInTheDocument()
  })

  it('"   " (whitespace) → emptyAlert (trim 검사)', () => {
    r(
      <TemplateButton
        workspaceId="ws-1"
        type="note"
        getJsonData={() => '   '}
        hasContent={false}
        onApply={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('현재 구성 저장'))
    expect(screen.getByText('저장할 내용이 비어있습니다')).toBeInTheDocument()
  })
})
