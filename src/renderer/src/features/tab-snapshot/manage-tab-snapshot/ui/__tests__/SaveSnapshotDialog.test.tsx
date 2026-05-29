/**
 * features/tab-snapshot/manage-tab-snapshot/ui/SaveSnapshotDialog.test.tsx
 *
 * 입력 후 저장 → useTabStore.getState() 호출 → createSnapshot({tabsJson/panesJson/layoutJson}).
 * 성공 → onOpenChange(false). 빈 이름 → 에러. isPending → 버튼 disabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createSnapshot: vi.fn(),
  isPending: false,
  state: { tabs: { t1: {} }, panes: { p1: {} }, layout: { id: 'r' } }
}))

vi.mock('@entities/tab-snapshot', () => ({
  useCreateTabSnapshot: () => ({ mutate: mocks.createSnapshot, isPending: mocks.isPending })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: { getState: () => mocks.state }
}))

import { SaveSnapshotDialog } from '../SaveSnapshotDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  workspaceId: 'ws-1'
}

beforeEach(() => {
  mocks.createSnapshot.mockReset()
  mocks.isPending = false
})

describe('SaveSnapshotDialog', () => {
  it('타이틀 + 필드 노출', () => {
    render(<SaveSnapshotDialog {...base} />)
    expect(screen.getByText('현재 탭 저장')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('스냅샷 이름')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('스냅샷 설명')).toBeInTheDocument()
  })

  it('이름 입력 후 저장 → createSnapshot(직렬화된 store) + onSuccess → onOpenChange(false)', async () => {
    const onOpenChange = vi.fn()
    mocks.createSnapshot.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(<SaveSnapshotDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.change(screen.getByPlaceholderText('스냅샷 이름'), { target: { value: '내 탭' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(mocks.createSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '내 탭',
          workspaceId: 'ws-1',
          tabsJson: JSON.stringify({ t1: {} }),
          panesJson: JSON.stringify({ p1: {} }),
          layoutJson: JSON.stringify({ id: 'r' })
        }),
        expect.any(Object)
      )
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('빈 이름 → 에러 메시지', async () => {
    render(<SaveSnapshotDialog {...base} />)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument())
    expect(mocks.createSnapshot).not.toHaveBeenCalled()
  })

  it('isPending=true → "저장 중..." disabled', () => {
    mocks.isPending = true
    render(<SaveSnapshotDialog {...base} />)
    expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<SaveSnapshotDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
