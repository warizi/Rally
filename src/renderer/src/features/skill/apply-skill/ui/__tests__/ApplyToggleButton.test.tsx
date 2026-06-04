/**
 * features/skill/apply-skill/ui/ApplyToggleButton.test.tsx
 *
 * applied=true → "적용됨" + hover 시 "해제" / applied=false → "적용" 버튼.
 * 클릭 → mutateAsync + toast.success.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  applyAsync: vi.fn().mockResolvedValue(undefined),
  unapplyAsync: vi.fn().mockResolvedValue(undefined),
  applyPending: false,
  unapplyPending: false,
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@entities/skill', () => ({
  useApplySkill: () => ({ mutateAsync: mocks.applyAsync, isPending: mocks.applyPending }),
  useUnapplySkill: () => ({ mutateAsync: mocks.unapplyAsync, isPending: mocks.unapplyPending })
}))
vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

import { ApplyToggleButton } from '../ApplyToggleButton'
import type { SkillItem } from '@entities/skill'

const SKILL = { id: 's-1', name: 'rally-do' } as unknown as SkillItem

beforeEach(() => {
  mocks.applyAsync.mockClear().mockResolvedValue(undefined)
  mocks.unapplyAsync.mockClear().mockResolvedValue(undefined)
  mocks.applyPending = false
  mocks.unapplyPending = false
  mocks.toastSuccess.mockClear()
  mocks.toastError.mockClear()
})

describe('ApplyToggleButton', () => {
  it('applied=false → "적용" 버튼 노출', () => {
    render(<ApplyToggleButton skill={SKILL} applied={false} />)
    expect(screen.getByRole('button', { name: /적용/ })).toBeInTheDocument()
  })

  it('applied=true → "적용됨" 표시', () => {
    render(<ApplyToggleButton skill={SKILL} applied={true} />)
    expect(screen.getByRole('button', { name: /적용됨/ })).toBeInTheDocument()
  })

  it('applied=false 클릭 → applyMutation + 성공 토스트', async () => {
    render(<ApplyToggleButton skill={SKILL} applied={false} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(mocks.applyAsync).toHaveBeenCalledWith({ id: 's-1', target: 'claude' })
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('적용했습니다'))
  })

  it('applied=true 클릭 → unapplyMutation + 해제 토스트', async () => {
    render(<ApplyToggleButton skill={SKILL} applied={true} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(mocks.unapplyAsync).toHaveBeenCalledWith({ id: 's-1', target: 'claude' })
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('해제했습니다'))
  })

  it('target=codex → codex 타겟으로 적용', async () => {
    render(<ApplyToggleButton skill={SKILL} applied={false} target="codex" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(mocks.applyAsync).toHaveBeenCalledWith({ id: 's-1', target: 'codex' })
    )
  })

  it('mutate 실패 → toast.error', async () => {
    mocks.applyAsync.mockRejectedValue(new Error('실패함'))
    render(<ApplyToggleButton skill={SKILL} applied={false} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('실패함'))
  })

  it('isPending=true → spinner 만 보이고 disabled', () => {
    mocks.applyPending = true
    render(<ApplyToggleButton skill={SKILL} applied={false} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })
})
