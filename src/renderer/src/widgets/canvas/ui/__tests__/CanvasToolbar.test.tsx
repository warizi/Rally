/**
 * widgets/canvas/ui/CanvasToolbar.test.tsx
 *
 * 5개의 버튼 (텍스트/요소/Undo/Redo/미니맵) 클릭 핸들러 연결.
 * canUndo/canRedo 분기 → disabled.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasToolbar } from '../CanvasToolbar'

const base = {
  onAddText: vi.fn(),
  onAddEntity: vi.fn(),
  minimap: false,
  onToggleMinimap: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: true,
  canRedo: true
}

describe('CanvasToolbar', () => {
  it('텍스트 + 요소 추가 + 미리보기 라벨 노출', () => {
    render(<CanvasToolbar {...base} />)
    expect(screen.getByText('텍스트')).toBeInTheDocument()
    expect(screen.getByText('요소 추가')).toBeInTheDocument()
    expect(screen.getByText('미리보기')).toBeInTheDocument()
  })

  it('텍스트 클릭 → onAddText', () => {
    const fn = vi.fn()
    render(<CanvasToolbar {...base} onAddText={fn} />)
    fireEvent.click(screen.getByText('텍스트'))
    expect(fn).toHaveBeenCalled()
  })

  it('요소 추가 클릭 → onAddEntity', () => {
    const fn = vi.fn()
    render(<CanvasToolbar {...base} onAddEntity={fn} />)
    fireEvent.click(screen.getByText('요소 추가'))
    expect(fn).toHaveBeenCalled()
  })

  it('미리보기 클릭 → onToggleMinimap', () => {
    const fn = vi.fn()
    render(<CanvasToolbar {...base} onToggleMinimap={fn} />)
    fireEvent.click(screen.getByText('미리보기'))
    expect(fn).toHaveBeenCalled()
  })

  it('canUndo=false → Undo 버튼 disabled', () => {
    const { container } = render(<CanvasToolbar {...base} canUndo={false} />)
    const btns = container.querySelectorAll('button')
    // Undo는 4번째 버튼 (텍스트, 요소, Undo, Redo, 미리보기)
    expect(btns[2]).toBeDisabled()
  })

  it('canRedo=false → Redo 버튼 disabled', () => {
    const { container } = render(<CanvasToolbar {...base} canRedo={false} />)
    const btns = container.querySelectorAll('button')
    expect(btns[3]).toBeDisabled()
  })

  it('minimap=true → 미리보기 버튼 활성 스타일 (bg-accent)', () => {
    render(<CanvasToolbar {...base} minimap={true} />)
    const btn = screen.getByText('미리보기').closest('button')!
    expect(btn.className).toMatch(/bg-accent/)
  })
})
