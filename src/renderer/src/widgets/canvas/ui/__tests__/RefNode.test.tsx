/**
 * widgets/canvas/ui/RefNode.test.tsx
 *
 * data.refTitle / label / isBrokenRef 분기.
 * Content component 등록 안 됨 → ScrollArea fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  registry: {} as Record<
    string,
    {
      icon: React.ComponentType
      label: string
      resizable: boolean
      component?: React.ComponentType<{ refId: string; refTitle: string }>
    }
  >,
  anyDragging: false,
  openTab: vi.fn(),
  closeTabByPathname: vi.fn()
}))

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  NodeResizer: () => null,
  useStore: (sel: (s: { nodes: Array<{ dragging: boolean }> }) => unknown) =>
    sel({ nodes: mocks.anyDragging ? [{ dragging: true }] : [] })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    sel: (s: {
      openTab: typeof mocks.openTab
      closeTabByPathname: typeof mocks.closeTabByPathname
    }) => unknown
  ) => sel({ openTab: mocks.openTab, closeTabByPathname: mocks.closeTabByPathname })
}))

vi.mock('@/widgets/entity-link', () => ({
  toTabOptions: () => null,
  PanePickerSubmenu: ({
    children
  }: {
    children: (p: { onClick: () => void; isOpen: boolean }) => React.ReactNode
  }) => <>{children({ onClick: () => {}, isOpen: false })}</>
}))

vi.mock('../../model/node-type-registry', () => ({
  get NODE_TYPE_REGISTRY() {
    return mocks.registry
  }
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  )
}))

import { RefNode } from '../RefNode'

const baseProps = {
  id: 'r1',
  selected: false,
  dragging: false,
  data: {
    nodeType: 'note',
    refId: 'n1',
    refTitle: 'My Note',
    color: null
  }
} as unknown as Parameters<typeof RefNode>[0]

beforeEach(() => {
  mocks.registry = {}
  mocks.anyDragging = false
  mocks.openTab.mockReset()
  mocks.closeTabByPathname.mockReset()
})

describe('RefNode', () => {
  it('config 없음 → fallback ScrollArea + 제목 노출', () => {
    render(<RefNode {...baseProps} />)
    expect(screen.getByTestId('scroll-area')).toBeInTheDocument()
    expect(screen.getAllByText('My Note').length).toBeGreaterThan(0)
  })

  it('refTitle 비었음 → "(제목 없음)" 노출', () => {
    const empty = {
      ...baseProps,
      data: { nodeType: 'note', refId: 'n1', refTitle: '', color: null }
    } as unknown as Parameters<typeof RefNode>[0]
    render(<RefNode {...empty} />)
    expect(screen.getByText('(제목 없음)')).toBeInTheDocument()
  })

  it('isBrokenRef (refId 있고 refTitle 없음) → destructive border 클래스', () => {
    const broken = {
      ...baseProps,
      data: { nodeType: 'note', refId: 'n1', refTitle: '', color: null }
    } as unknown as Parameters<typeof RefNode>[0]
    const { container } = render(<RefNode {...broken} />)
    expect(container.innerHTML).toMatch(/border-destructive/)
  })

  it('config 에 component 등록 → content component 렌더', () => {
    mocks.registry = {
      note: {
        icon: () => null,
        label: '노트',
        resizable: true,
        component: ({ refTitle }) => <div data-testid="content">{refTitle}</div>
      }
    }
    render(<RefNode {...baseProps} />)
    expect(screen.getByTestId('content')).toHaveTextContent('My Note')
  })

  it('selected=true → ring-2 ring-primary 클래스', () => {
    const sel = { ...baseProps, selected: true } as unknown as Parameters<typeof RefNode>[0]
    const { container } = render(<RefNode {...sel} />)
    expect(container.innerHTML).toMatch(/ring-2/)
  })
})
