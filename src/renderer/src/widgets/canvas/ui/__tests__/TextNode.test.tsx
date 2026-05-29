/**
 * widgets/canvas/ui/TextNode.test.tsx
 *
 * editing 진입 (double click) + blur 시 변경 있으면 updateNode mutate.
 * selected → ring-2 클래스. 빈 content → placeholder 안내.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn()
}))

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  NodeResizer: () => null
}))

vi.mock('@entities/canvas', () => ({
  useUpdateCanvasNode: () => ({ mutate: mocks.mutate })
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    onDoubleClick
  }: {
    children: React.ReactNode
    onDoubleClick?: () => void
  }) => (
    <div data-testid="scroll-area" onDoubleClick={onDoubleClick}>
      {children}
    </div>
  )
}))

import { TextNode } from '../TextNode'

const baseProps = {
  id: 'n1',
  selected: false,
  data: { content: 'hello', canvasId: 'c1', color: null }
} as unknown as Parameters<typeof TextNode>[0]

beforeEach(() => {
  mocks.mutate.mockReset()
})

describe('TextNode', () => {
  it('content 노출', () => {
    render(<TextNode {...baseProps} />)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('빈 content → placeholder 안내 노출', () => {
    const empty = {
      ...baseProps,
      data: { content: '', canvasId: 'c1', color: null }
    } as unknown as Parameters<typeof TextNode>[0]
    render(<TextNode {...empty} />)
    expect(screen.getByText('더블클릭하여 편집')).toBeInTheDocument()
  })

  it('selected=true → ring-2 ring-primary 클래스', () => {
    const sel = { ...baseProps, selected: true } as unknown as Parameters<typeof TextNode>[0]
    const { container } = render(<TextNode {...sel} />)
    expect(container.innerHTML).toMatch(/ring-2/)
  })

  it('double click → editing 모드 (textarea 등장)', () => {
    render(<TextNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByTestId('scroll-area'))
    expect(screen.getByRole('textbox')).toHaveValue('hello')
  })

  it('편집 후 blur, 값 변경 → updateNode.mutate({content})', () => {
    render(<TextNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByTestId('scroll-area'))
    const ta = screen.getByRole('textbox')
    fireEvent.change(ta, { target: { value: 'world' } })
    fireEvent.blur(ta)
    expect(mocks.mutate).toHaveBeenCalledWith({
      nodeId: 'n1',
      data: { content: 'world' },
      canvasId: 'c1'
    })
  })

  it('편집 후 blur, 값 동일 → mutate 호출 안 함', () => {
    render(<TextNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByTestId('scroll-area'))
    fireEvent.blur(screen.getByRole('textbox'))
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
})
