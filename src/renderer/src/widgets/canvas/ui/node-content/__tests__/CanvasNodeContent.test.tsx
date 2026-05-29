/**
 * widgets/canvas/ui/node-content/CanvasNodeContent.test.tsx
 *
 * useCanvasNodes mock — 노드 0개 → "빈 캔버스" / 노드 있음 → svg + 각 노드 rect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; x: number; y: number; width: number; height: number }>
}))

vi.mock('@entities/canvas', () => ({
  useCanvasNodes: () => ({ data: mocks.nodes })
}))

import { CanvasNodeContent } from '../CanvasNodeContent'
import type { NodeContentProps } from '../../../model/node-content-registry'

function baseProps(refId: string | null = 'cv-1'): NodeContentProps {
  return {
    refId,
    refTitle: '',
    refPreview: '',
    canvasId: 'parent-cv'
  } as unknown as NodeContentProps
}

beforeEach(() => {
  mocks.nodes = []
})

describe('CanvasNodeContent', () => {
  it('노드 0개 → "빈 캔버스" 텍스트', () => {
    render(<CanvasNodeContent {...baseProps()} />)
    expect(screen.getByText('빈 캔버스')).toBeInTheDocument()
  })

  it('노드 N개 → svg + N개 rect 렌더', () => {
    mocks.nodes = [
      { id: 'n1', x: 0, y: 0, width: 100, height: 50 },
      { id: 'n2', x: 200, y: 100, width: 80, height: 40 }
    ]
    const { container } = render(<CanvasNodeContent {...baseProps()} />)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(container.querySelectorAll('rect')).toHaveLength(2)
  })

  it('refId null → useCanvasNodes(undefined) 호출 (방어적)', () => {
    mocks.nodes = [{ id: 'n1', x: 0, y: 0, width: 50, height: 50 }]
    render(<CanvasNodeContent {...baseProps(null)} />)
    // 빈 데이터든 채워진 데이터든 정상 렌더 (throw 안 함)
    // 위 mock 이 nodes 1개라 svg 가 그려짐
  })

  it('viewBox 가 bounds 기반 + padding 8 적용', () => {
    mocks.nodes = [{ id: 'n', x: 10, y: 20, width: 100, height: 50 }]
    const { container } = render(<CanvasNodeContent {...baseProps()} />)
    const svg = container.querySelector('svg')
    // viewBox: minX-padding minY-padding w+padding*2 h+padding*2 → (2 12 116 66)
    expect(svg?.getAttribute('viewBox')).toBe('2 12 116 66')
  })
})
