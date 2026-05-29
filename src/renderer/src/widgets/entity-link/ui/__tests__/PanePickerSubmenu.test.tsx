/**
 * widgets/entity-link/ui/PanePickerSubmenu.test.tsx
 *
 * children prop 으로 trigger 받아 클릭 시 portal 안에 layout 렌더.
 * pane 버튼 클릭 → onPaneSelect(paneId) + portal 닫힘.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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
  layout: { id: 'r', type: 'pane', paneId: 'p1' } as FakeNode,
  panes: { p1: { tabIds: ['t1', 't2'] } } as Record<string, { tabIds: string[] }>
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { layout: FakeNode; panes: typeof mocks.panes }) => unknown) =>
    sel({ layout: mocks.layout, panes: mocks.panes })
}))

import { PanePickerSubmenu } from '../PanePickerSubmenu'

beforeEach(() => {
  mocks.layout = { id: 'r', type: 'pane', paneId: 'p1' }
  mocks.panes = { p1: { tabIds: ['t1', 't2'] } }
})

describe('PanePickerSubmenu', () => {
  it('children render function 호출 + 초기 isOpen=false', () => {
    let received: { isOpen: boolean } | null = null
    render(
      <PanePickerSubmenu onPaneSelect={vi.fn()}>
        {(p) => {
          received = p
          return <button data-testid="trigger">trigger</button>
        }}
      </PanePickerSubmenu>
    )
    expect(received!.isOpen).toBe(false)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
  })

  it('trigger 클릭 → portal 안에 pane 버튼 + tab count 노출', () => {
    render(
      <PanePickerSubmenu onPaneSelect={vi.fn()}>
        {({ onClick }) => (
          <button data-testid="trigger" onClick={(e) => onClick(e as React.MouseEvent)}>
            trigger
          </button>
        )}
      </PanePickerSubmenu>
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('탭 영역을 선택하세요')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // tabIds.length
  })

  it('pane 버튼 클릭 → onPaneSelect(paneId)', () => {
    const onPaneSelect = vi.fn()
    render(
      <PanePickerSubmenu onPaneSelect={onPaneSelect}>
        {({ onClick }) => (
          <button data-testid="trigger" onClick={(e) => onClick(e as React.MouseEvent)}>
            trigger
          </button>
        )}
      </PanePickerSubmenu>
    )
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByText('2'))
    expect(onPaneSelect).toHaveBeenCalledWith('p1')
  })

  it('split 트리 → 각 pane 별 버튼 노출', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [
        { id: 'a', type: 'pane', paneId: 'p1' },
        { id: 'b', type: 'pane', paneId: 'p2' }
      ]
    }
    mocks.panes = { p1: { tabIds: ['t1'] }, p2: { tabIds: [] } }
    render(
      <PanePickerSubmenu onPaneSelect={vi.fn()}>
        {({ onClick }) => (
          <button data-testid="trigger" onClick={(e) => onClick(e as React.MouseEvent)}>
            trigger
          </button>
        )}
      </PanePickerSubmenu>
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
