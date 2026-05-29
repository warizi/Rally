/**
 * widgets/tab-system/ui/TabItem.test.tsx
 *
 * Tab 표시 + onActivate/onClose + lock toggle. useSortable mock 으로 dnd-kit 우회.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } }
}))

const lockState = { current: { isLockable: false, isLocked: false, toggle: vi.fn() } }
vi.mock('../../model/use-tab-lock-state', () => ({
  useTabLockState: () => lockState.current
}))

import { TabItem } from '../TabItem'
import type { Tab } from '@/entities/tab-system'

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    type: 'todo',
    icon: 'todo',
    title: 'My Todo',
    pathname: '/todo',
    pinned: false,
    error: false,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    ...overrides
  } as unknown as Tab
}

beforeEach(() => {
  lockState.current = { isLockable: false, isLocked: false, toggle: vi.fn() }
})

describe('TabItem', () => {
  it('title 노출', () => {
    render(<TabItem tab={makeTab()} isActive={false} onActivate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('My Todo')).toBeInTheDocument()
  })

  it('클릭 → onActivate 호출', () => {
    const activate = vi.fn()
    render(<TabItem tab={makeTab()} isActive={false} onActivate={activate} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('My Todo'))
    expect(activate).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 → onClose 호출 + 부모로 propagation 안 됨', () => {
    const onActivate = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <TabItem tab={makeTab()} isActive={false} onActivate={onActivate} onClose={onClose} />
    )
    // X 버튼은 마지막 button
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[buttons.length - 1])
    expect(onClose).toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('pinned=true → 닫기 버튼 미노출 + Pin 아이콘', () => {
    const { container } = render(
      <TabItem
        tab={makeTab({ pinned: true })}
        isActive={false}
        onActivate={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(container.querySelector('svg.lucide-pin')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-x')).not.toBeInTheDocument()
  })

  it('error=true → line-through + destructive', () => {
    render(
      <TabItem
        tab={makeTab({ error: true })}
        isActive={false}
        onActivate={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const titleEl = screen.getByText('My Todo')
    expect(titleEl.className).toMatch(/line-through/)
  })

  it('isLockable=true + isLocked=true → Lock 아이콘 + 클릭 시 toggle 호출', () => {
    const toggle = vi.fn()
    lockState.current = { isLockable: true, isLocked: true, toggle }
    const { container } = render(
      <TabItem tab={makeTab()} isActive={true} onActivate={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.querySelector('svg.lucide-lock')).toBeInTheDocument()
    const lockBtn = screen.getByRole('button', { name: '잠금 해제' })
    fireEvent.click(lockBtn)
    expect(toggle).toHaveBeenCalled()
  })

  it('우클릭 → onContextMenu 호출', () => {
    const onContextMenu = vi.fn()
    render(
      <TabItem
        tab={makeTab()}
        isActive={false}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onContextMenu={onContextMenu}
      />
    )
    fireEvent.contextMenu(screen.getByText('My Todo'))
    expect(onContextMenu).toHaveBeenCalled()
  })
})
