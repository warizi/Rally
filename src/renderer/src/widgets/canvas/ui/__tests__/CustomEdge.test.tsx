/**
 * widgets/canvas/ui/CustomEdge.test.tsx
 *
 * BaseEdge + 선택 시 stroke 색상. label 있으면 EdgeLabelRenderer.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ style, id }: { style?: Record<string, unknown>; id: string }) => (
    <div data-testid={`base-edge-${id}`} data-style={JSON.stringify(style ?? {})}>
      base
    </div>
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="label-renderer">{children}</div>
  ),
  getBezierPath: () => ['M0,0 L10,10', 5, 5]
}))

import { CustomEdge } from '../CustomEdge'

const baseProps = {
  id: 'e1',
  sourceX: 0,
  sourceY: 0,
  targetX: 10,
  targetY: 10,
  sourcePosition: 'right',
  targetPosition: 'left',
  style: {}
} as unknown as Parameters<typeof CustomEdge>[0]

describe('CustomEdge', () => {
  it('label 없음 → EdgeLabelRenderer 미렌더', () => {
    render(<CustomEdge {...baseProps} />)
    expect(screen.getByTestId('base-edge-e1')).toBeInTheDocument()
    expect(screen.queryByTestId('label-renderer')).not.toBeInTheDocument()
  })

  it('label 있음 → EdgeLabelRenderer 안에 label 노출', () => {
    render(<CustomEdge {...baseProps} label="Hello" />)
    expect(screen.getByTestId('label-renderer')).toHaveTextContent('Hello')
  })

  it('selected=true → BaseEdge style 에 stroke: var(--primary)', () => {
    render(<CustomEdge {...baseProps} selected />)
    const styleAttr = screen.getByTestId('base-edge-e1').getAttribute('data-style')!
    const parsed = JSON.parse(styleAttr)
    expect(parsed.stroke).toBe('var(--primary)')
    expect(parsed.strokeWidth).toBe(2.5)
  })

  it('selected + label → label wrapper 에 ring-1 클래스', () => {
    const { container } = render(<CustomEdge {...baseProps} selected label="X" />)
    expect(container.innerHTML).toMatch(/ring-1/)
  })
})
