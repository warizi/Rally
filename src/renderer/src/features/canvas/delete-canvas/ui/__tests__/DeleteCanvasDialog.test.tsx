/**
 * features/canvas/delete-canvas/ui/DeleteCanvasDialog.test.tsx
 *
 * AlertDialog open=true → 캔버스 제목 / 취소 / 삭제 버튼 노출.
 * 삭제 클릭 → removeCanvas mutate + onDeleted 콜백.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRemoveCanvas } from '@entities/canvas'
import { DeleteCanvasDialog } from '../DeleteCanvasDialog'

vi.mock('@entities/canvas', () => ({
  useRemoveCanvas: vi.fn()
}))

const mutate = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRemoveCanvas).mockReturnValue({ mutate } as unknown as ReturnType<
    typeof useRemoveCanvas
  >)
})

const baseProps = {
  canvasId: 'cv-1',
  canvasTitle: 'My Canvas',
  workspaceId: 'ws-1',
  open: true,
  onOpenChange: vi.fn()
}

describe('DeleteCanvasDialog', () => {
  it('open=true → 캔버스 제목 + 삭제 버튼 노출', () => {
    render(<DeleteCanvasDialog {...baseProps} />)
    expect(screen.getByText(/My Canvas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
  })

  it('삭제 클릭 → removeCanvas({canvasId, workspaceId}) 호출', () => {
    render(<DeleteCanvasDialog {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(mutate).toHaveBeenCalledWith(
      { canvasId: 'cv-1', workspaceId: 'ws-1' },
      expect.objectContaining({ onSuccess: undefined })
    )
  })

  it('onDeleted 콜백 forwarding (성공 시 호출)', () => {
    const onDeleted = vi.fn()
    mutate.mockImplementation((_args, opts: { onSuccess: () => void }) => opts.onSuccess())
    render(<DeleteCanvasDialog {...baseProps} onDeleted={onDeleted} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDeleted).toHaveBeenCalled()
  })

  it('open=false → 콘텐츠 미노출', () => {
    render(<DeleteCanvasDialog {...baseProps} open={false} />)
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })
})
