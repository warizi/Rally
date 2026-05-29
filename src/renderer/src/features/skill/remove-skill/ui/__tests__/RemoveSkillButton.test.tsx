/**
 * features/skill/remove-skill/ui/RemoveSkillButton.test.tsx
 *
 * source='system' → null. source='user' → 버튼 노출 + dialog 열기 + 휴지통 이동.
 * workspaceId 없음 → toast.error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  workspaceId: 'ws-1' as string | null,
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@entities/skill', () => ({
  useRemoveSkill: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending })
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

import { RemoveSkillButton } from '../RemoveSkillButton'

const userSkill = {
  id: 'sk-1',
  name: 'my-skill',
  source: 'user'
} as unknown as Parameters<typeof RemoveSkillButton>[0]['skill']

const systemSkill = {
  id: 'sk-sys',
  name: 'sys-skill',
  source: 'system'
} as unknown as Parameters<typeof RemoveSkillButton>[0]['skill']

beforeEach(() => {
  mocks.mutateAsync.mockReset()
  mocks.isPending = false
  mocks.workspaceId = 'ws-1'
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('RemoveSkillButton', () => {
  it('source=system → null 반환 (버튼 미노출)', () => {
    const { container } = render(<RemoveSkillButton skill={systemSkill} />)
    expect(container.firstChild).toBeNull()
  })

  it('source=user → 삭제 버튼 노출', () => {
    render(<RemoveSkillButton skill={userSkill} />)
    expect(screen.getByTitle('삭제')).toBeInTheDocument()
  })

  it('버튼 클릭 → AlertDialog 열기 + 스킬 이름 노출', () => {
    render(<RemoveSkillButton skill={userSkill} />)
    fireEvent.click(screen.getByTitle('삭제'))
    expect(screen.getByText('my-skill')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '휴지통으로' })).toBeInTheDocument()
  })

  it('휴지통으로 클릭 → mutateAsync({workspaceId,id}) + toast.success', async () => {
    mocks.mutateAsync.mockResolvedValue(undefined)
    render(<RemoveSkillButton skill={userSkill} />)
    fireEvent.click(screen.getByTitle('삭제'))
    fireEvent.click(screen.getByRole('button', { name: '휴지통으로' }))
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ workspaceId: 'ws-1', id: 'sk-1' })
    )
    expect(mocks.toastSuccess).toHaveBeenCalled()
  })

  it('workspaceId 없음 → toast.error 만 호출, mutate 호출 안 함', async () => {
    mocks.workspaceId = null
    render(<RemoveSkillButton skill={userSkill} />)
    fireEvent.click(screen.getByTitle('삭제'))
    fireEvent.click(screen.getByRole('button', { name: '휴지통으로' }))
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('활성 워크스페이스가 없습니다.')
    )
    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  it('mutateAsync 실패 → toast.error(에러 메시지)', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('oops'))
    render(<RemoveSkillButton skill={userSkill} />)
    fireEvent.click(screen.getByTitle('삭제'))
    fireEvent.click(screen.getByRole('button', { name: '휴지통으로' }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('oops'))
  })
})
