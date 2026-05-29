/**
 * widgets/settings/ui/TrashSettings.test.tsx
 *
 * RadioGroup 변경 → setRetentionM.mutate / "never" → 경고 / 빈 워크스페이스 안내.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  retentionData: '30',
  count: 0,
  setRetentionMutate: vi.fn(),
  emptyMutate: vi.fn(),
  emptyPending: false
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/trash', () => ({
  useTrashRetention: () => ({ data: mocks.retentionData }),
  useTrashCount: () => ({ data: mocks.count }),
  TRASH_RETENTION_OPTIONS: [
    { value: '1', label: '1일' },
    { value: '30', label: '30일' },
    { value: 'never', label: '자동 안 함' }
  ]
}))
vi.mock('@features/trash', () => ({
  useEmptyTrash: () => ({ mutate: mocks.emptyMutate, isPending: mocks.emptyPending }),
  useSetTrashRetention: () => ({ mutate: mocks.setRetentionMutate })
}))

import { TrashSettings } from '../TrashSettings'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.retentionData = '30'
  mocks.count = 0
  mocks.emptyPending = false
  mocks.setRetentionMutate.mockClear()
  mocks.emptyMutate.mockClear()
})

describe('TrashSettings', () => {
  it('타이틀 + RadioGroup 옵션 노출', () => {
    render(<TrashSettings />)
    expect(screen.getByText('자동 비우기')).toBeInTheDocument()
    expect(screen.getByText('1일')).toBeInTheDocument()
    expect(screen.getByText('30일')).toBeInTheDocument()
    expect(screen.getByText('자동 안 함')).toBeInTheDocument()
  })

  it('current="never" → 경고 메시지 노출', () => {
    mocks.retentionData = 'never'
    render(<TrashSettings />)
    expect(screen.getByText(/자동 비우기가 비활성화/)).toBeInTheDocument()
  })

  it('Radio 변경 → setRetentionM.mutate 호출', () => {
    render(<TrashSettings />)
    fireEvent.click(screen.getByLabelText('1일'))
    expect(mocks.setRetentionMutate).toHaveBeenCalledWith('1', expect.any(Object))
  })

  it('workspaceId 없음 → "워크스페이스를 선택해주세요"', () => {
    mocks.workspaceId = null
    render(<TrashSettings />)
    expect(screen.getByText('워크스페이스를 선택해주세요')).toBeInTheDocument()
  })

  it('count > 0 → "N개 항목" 노출 + 비우기 버튼 활성', () => {
    mocks.count = 5
    render(<TrashSettings />)
    expect(screen.getByText('5개 항목')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /지금 비우기/ })).not.toBeDisabled()
  })

  it('count = 0 → "지금 비우기" disabled', () => {
    render(<TrashSettings />)
    expect(screen.getByRole('button', { name: /지금 비우기/ })).toBeDisabled()
  })
})
