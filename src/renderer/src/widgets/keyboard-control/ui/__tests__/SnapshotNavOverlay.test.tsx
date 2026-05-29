/**
 * widgets/keyboard-control/ui/SnapshotNavOverlay.test.tsx
 *
 * open=false → null / open=true → KeyboardOverlayPicker.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  open: false,
  items: [] as Array<{ snapshotId: string; name: string; description: string | null }>,
  focusIndex: 0
}))

vi.mock('../../model/snapshot-nav-store', () => ({
  useSnapshotNavStore: (
    sel: (s: { open: boolean; items: typeof mocks.items; focusIndex: number }) => unknown
  ) => sel({ open: mocks.open, items: mocks.items, focusIndex: mocks.focusIndex })
}))
vi.mock('../KeyboardOverlayPicker', () => ({
  KeyboardOverlayPicker: ({
    title,
    items,
    focusIndex
  }: {
    title: string
    items: Array<{ id: string; label: string }>
    focusIndex: number
  }) => (
    <div data-testid="picker" data-title={title} data-focus={focusIndex}>
      {items.map((it) => (
        <div key={it.id}>{it.label}</div>
      ))}
    </div>
  )
}))

import { SnapshotNavOverlay } from '../SnapshotNavOverlay'

beforeEach(() => {
  mocks.open = false
  mocks.items = []
  mocks.focusIndex = 0
})

describe('SnapshotNavOverlay', () => {
  it('open=false → null', () => {
    const { container } = render(<SnapshotNavOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('open=true → KeyboardOverlayPicker 노출 + 제목', () => {
    mocks.open = true
    mocks.items = [{ snapshotId: 's1', name: 'Snap1', description: null }]
    render(<SnapshotNavOverlay />)
    expect(screen.getByTestId('picker')).toHaveAttribute('data-title', '탭 스냅샷 전환')
    expect(screen.getByText('Snap1')).toBeInTheDocument()
  })

  it('focusIndex 전달', () => {
    mocks.open = true
    mocks.focusIndex = 2
    render(<SnapshotNavOverlay />)
    expect(screen.getByTestId('picker')).toHaveAttribute('data-focus', '2')
  })
})
