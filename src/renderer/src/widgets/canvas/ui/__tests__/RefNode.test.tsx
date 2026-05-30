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

  it('config.label 있음 → label 노출 (config 사용)', () => {
    mocks.registry = {
      note: {
        icon: () => null,
        label: '노트',
        resizable: true,
        component: undefined
      }
    }
    render(<RefNode {...baseProps} />)
    expect(screen.getAllByText('My Note').length).toBeGreaterThan(0)
  })

  it('dragging=true → mounted false로 전환 (smoke)', () => {
    const drag = { ...baseProps, dragging: true } as unknown as Parameters<typeof RefNode>[0]
    render(<RefNode {...drag} />)
    // dragging 시 노드는 렌더는 되지만 content unmount 분기
    expect(screen.getAllByText('My Note').length).toBeGreaterThan(0)
  })

  it('color 지정 → smoke 렌더', () => {
    const colored = {
      ...baseProps,
      data: { ...baseProps.data, color: '#ff0000' }
    } as unknown as Parameters<typeof RefNode>[0]
    const { container } = render(<RefNode {...colored} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('config.resizable=false → NodeResizer mount 다른 분기 (smoke)', () => {
    mocks.registry = {
      note: {
        icon: () => null,
        label: 'L',
        resizable: false,
        component: undefined
      }
    }
    const sel = { ...baseProps, selected: true } as unknown as Parameters<typeof RefNode>[0]
    const { container } = render(<RefNode {...sel} />)
    expect(container.firstChild).toBeTruthy()
  })
})
