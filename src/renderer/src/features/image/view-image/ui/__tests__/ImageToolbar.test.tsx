/**
 * features/image/view-image/ui/ImageToolbar.test.tsx
 *
 * Zoom in/out/reset 버튼 + 경계값 disabled.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageToolbar } from '../ImageToolbar'

const callbacks = {
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onReset: vi.fn()
}

describe('ImageToolbar', () => {
  it('scale 을 백분율로 표시 (Math.round)', () => {
    render(<ImageToolbar scale={1.234} {...callbacks} />)
    expect(screen.getByText('123%')).toBeInTheDocument()
  })

  it('scale ≤ 0.1 → ZoomOut 버튼 disabled', () => {
    const { container } = render(<ImageToolbar scale={0.1} {...callbacks} />)
    const buttons = container.querySelectorAll('button')
    // 순서: ZoomOut / ZoomIn / Reset
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('scale ≥ 10 → ZoomIn 버튼 disabled', () => {
    const { container } = render(<ImageToolbar scale={10} {...callbacks} />)
    const buttons = container.querySelectorAll('button')
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true)
  })

  it('Reset 클릭 → onReset', () => {
    const { container } = render(<ImageToolbar scale={1} {...callbacks} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[2])
    expect(callbacks.onReset).toHaveBeenCalled()
  })

  it('ZoomIn 클릭 → onZoomIn', () => {
    const onZoomIn = vi.fn()
    const { container } = render(
      <ImageToolbar
        scale={1}
        onZoomIn={onZoomIn}
        onZoomOut={callbacks.onZoomOut}
        onReset={callbacks.onReset}
      />
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1])
    expect(onZoomIn).toHaveBeenCalled()
  })
})
