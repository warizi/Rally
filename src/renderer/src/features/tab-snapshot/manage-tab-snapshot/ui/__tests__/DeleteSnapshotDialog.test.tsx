/**
 * features/tab-snapshot/manage-tab-snapshot/ui/DeleteSnapshotDialog.test.tsx
 *
 * AlertDialog open + snapshot 이름 + 삭제 클릭 → deleteSnapshot.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  deleteMutate: vi.fn(),
  pending: false
}))

vi.mock('@entities/tab-snapshot', () => ({
  useDeleteTabSnapshot: () => ({ mutate: mocks.deleteMutate, isPending: mocks.pending })
}))

import { DeleteSnapshotDialog } from '../DeleteSnapshotDialog'
import type { TabSnapshot } from '@entities/tab-snapshot'

beforeEach(() => {
  mocks.deleteMutate.mockClear()
  mocks.pending = false
})

const snap: TabSnapshot = { id: 's-1', name: 'My Snap' } as unknown as TabSnapshot

describe('DeleteSnapshotDialog', () => {
  it('open=false → 미렌더', () => {
    render(<DeleteSnapshotDialog open={false} onOpenChange={vi.fn()} snapshot={snap} />)
    expect(screen.queryByText('스냅샷 삭제')).not.toBeInTheDocument()
  })

  it('open=true → 타이틀 + 이름 노출', () => {
    render(<DeleteSnapshotDialog open={true} onOpenChange={vi.fn()} snapshot={snap} />)
    expect(screen.getByText('스냅샷 삭제')).toBeInTheDocument()
    expect(screen.getByText('"My Snap"')).toBeInTheDocument()
  })

  it('삭제 클릭 → deleteSnapshot mutate', () => {
    render(<DeleteSnapshotDialog open={true} onOpenChange={vi.fn()} snapshot={snap} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(mocks.deleteMutate).toHaveBeenCalledWith('s-1', expect.any(Object))
  })

  it('isPending=true → "삭제 중..." + disabled', () => {
    mocks.pending = true
    render(<DeleteSnapshotDialog open={true} onOpenChange={vi.fn()} snapshot={snap} />)
    const btn = screen.getByRole('button', { name: '삭제 중...' })
    expect(btn).toBeDisabled()
  })

  it('snapshot=null → 삭제 클릭 무시 (mutate 호출 안 함)', () => {
    render(<DeleteSnapshotDialog open={true} onOpenChange={vi.fn()} snapshot={null} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(mocks.deleteMutate).not.toHaveBeenCalled()
  })
})
