/**
 * widgets/keyboard-control/ui/PaneNavOverlay.test.tsx
 *
 * mode 가 'pane-nav' 아닐 때 null. pane-nav 일 때 LayoutMini 가 재귀 렌더.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

type FakeNode =
  | { id: string; type: 'pane'; paneId: string }
  | {
      id: string
      type: 'split'
      direction: 'horizontal' | 'vertical'
      sizes: number[]
      children: FakeNode[]
    }

const mocks = vi.hoisted(() => ({
  mode: null as null | 'pane-nav' | 'tab-nav' | 'snapshot-nav',
  layout: { id: 'root', type: 'pane', paneId: 'p1' } as FakeNode,
  activePaneId: 'p1'
}))

vi.mock('../../model/keyboard-mode-store', () => ({
  useKeyboardModeStore: (sel: (s: { mode: typeof mocks.mode }) => unknown) =>
    sel({ mode: mocks.mode })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { layout: FakeNode; activePaneId: string }) => unknown) =>
    sel({ layout: mocks.layout, activePaneId: mocks.activePaneId })
}))
vi.mock('@/entities/tab-system/model/types', () => ({
  isPaneNode: (n: FakeNode) => n.type === 'pane'
}))

import { PaneNavOverlay } from '../PaneNavOverlay'

beforeEach(() => {
  mocks.mode = null
  mocks.layout = { id: 'root', type: 'pane', paneId: 'p1' }
  mocks.activePaneId = 'p1'
})

describe('PaneNavOverlay', () => {
  it("mode !== 'pane-nav' → null", () => {
    const { container } = render(<PaneNavOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it("mode === 'pane-nav' → 오버레이 + 안내문 노출", () => {
    mocks.mode = 'pane-nav'
    render(<PaneNavOverlay />)
    expect(screen.getByTestId('pane-nav-overlay')).toBeInTheDocument()
    expect(screen.getByText('Pane 이동')).toBeInTheDocument()
    expect(screen.getByText(/ctrl \+ shift/)).toBeInTheDocument()
  })

  it('split layout → 모든 pane 자식 재귀 렌더', () => {
    mocks.mode = 'pane-nav'
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [
        { id: 'a', type: 'pane', paneId: 'p1' },
        {
          id: 's',
          type: 'split',
          direction: 'vertical',
          sizes: [1, 1],
          children: [
            { id: 'b', type: 'pane', paneId: 'p2' },
            { id: 'c', type: 'pane', paneId: 'p3' }
          ]
        }
      ]
    }
    mocks.activePaneId = 'p2'
    const { container } = render(<PaneNavOverlay />)
    expect(container.querySelectorAll('.bg-primary\\/30').length).toBe(1)
    expect(container.querySelectorAll('.bg-card\\/40').length).toBe(2)
  })
})
