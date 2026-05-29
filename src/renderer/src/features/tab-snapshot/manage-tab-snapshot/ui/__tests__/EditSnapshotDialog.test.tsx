/**
 * features/tab-snapshot/manage-tab-snapshot/ui/EditSnapshotDialog.test.tsx
 *
 * snapshot 으로 form 초기화. 수정 → updateSnapshot({id,name,description}) + onSuccess → close.
 * snapshot=null → submit 무시.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  updateSnapshot: vi.fn(),
  isPending: false
}))

vi.mock('@entities/tab-snapshot', () => ({
  useUpdateTabSnapshot: () => ({ mutate: mocks.updateSnapshot, isPending: mocks.isPending })
}))

import { EditSnapshotDialog } from '../EditSnapshotDialog'

const snap = {
  id: 's1',
  name: '원본 이름',
  description: '원본 설명'
} as unknown as Parameters<typeof EditSnapshotDialog>[0]['snapshot']

beforeEach(() => {
  mocks.updateSnapshot.mockReset()
  mocks.isPending = false
})

describe('EditSnapshotDialog', () => {
  it('snapshot → name/description 초기 값 노출', () => {
    render(<EditSnapshotDialog open={true} onOpenChange={vi.fn()} snapshot={snap} />)
    expect(screen.getByDisplayValue('원본 이름')).toBeInTheDocument()
    expect(screen.getByDisplayValue('원본 설명')).toBeInTheDocument()
  })

  it('수정 후 저장 → updateSnapshot({id, name, description}) + close', async () => {
    const onOpenChange = vi.fn()
    mocks.updateSnapshot.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(<EditSnapshotDialog open={true} onOpenChange={onOpenChange} snapshot={snap} />)
    fireEvent.change(screen.getByPlaceholderText('스냅샷 이름'), {
      target: { value: '변경 이름' }
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(mocks.updateSnapshot).toHaveBeenCalledWith(
        { id: 's1', name: '변경 이름', description: '원본 설명' },
        expect.any(Object)
      )
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('snapshot=null → 저장 클릭해도 mutate 안 함', async () => {
    render(<EditSnapshotDialog open={true} onOpenChange={vi.fn()} snapshot={null} />)
    fireEvent.change(screen.getByPlaceholderText('스냅샷 이름'), { target: { value: 'foo' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(mocks.updateSnapshot).not.toHaveBeenCalled()
  })

  it('빈 이름 → 에러 메시지', async () => {
    const empty = { ...(snap as { id: string; name: string; description: string }), name: '' }
    render(
      <EditSnapshotDialog
        open={true}
        onOpenChange={vi.fn()}
        snapshot={empty as unknown as Parameters<typeof EditSnapshotDialog>[0]['snapshot']}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument())
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<EditSnapshotDialog open={true} onOpenChange={onOpenChange} snapshot={snap} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
