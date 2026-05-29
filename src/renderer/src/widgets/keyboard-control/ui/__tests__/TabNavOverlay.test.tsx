/**
 * widgets/keyboard-control/ui/TabNavOverlay.test.tsx
 *
 * open=false → null / open=true → KeyboardOverlayPicker + TAB_ICON 매핑.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  open: false,
  items: [] as Array<{ tabId: string; title: string; type: string }>,
  focusIndex: 0
}))

vi.mock('../../model/tab-nav-store', () => ({
  useTabNavStore: (
    sel: (s: { open: boolean; items: typeof mocks.items; focusIndex: number }) => unknown
  ) => sel({ open: mocks.open, items: mocks.items, focusIndex: mocks.focusIndex })
}))
vi.mock('../KeyboardOverlayPicker', () => ({
  KeyboardOverlayPicker: ({
    title,
    items
  }: {
    title: string
    items: Array<{ id: string; label: string }>
  }) => (
    <div data-testid="picker" data-title={title}>
      {items.map((it) => (
        <div key={it.id}>{it.label}</div>
      ))}
    </div>
  )
}))

import { TabNavOverlay } from '../TabNavOverlay'

beforeEach(() => {
  mocks.open = false
  mocks.items = []
  mocks.focusIndex = 0
})

describe('TabNavOverlay', () => {
  it('open=false → null', () => {
    const { container } = render(<TabNavOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('open=true → 탭 목록 노출 + 제목 "탭 이동"', () => {
    mocks.open = true
    mocks.items = [
      { tabId: 't1', title: 'Todo Tab', type: 'todo' },
      { tabId: 't2', title: 'Note Tab', type: 'note' }
    ]
    render(<TabNavOverlay />)
    expect(screen.getByTestId('picker')).toHaveAttribute('data-title', '탭 이동')
    expect(screen.getByText('Todo Tab')).toBeInTheDocument()
    expect(screen.getByText('Note Tab')).toBeInTheDocument()
  })

  it('알 수 없는 type → icon=null 처리 (fallback)', () => {
    mocks.open = true
    mocks.items = [{ tabId: 't1', title: 'Unknown', type: 'unknown-type' }]
    render(<TabNavOverlay />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
