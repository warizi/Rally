/**
 * features/skill/export-skill/ui/ExportSkillButton.test.tsx
 *
 * 버튼 클릭 → window.api.skill.export → toast (성공/실패/취소).
 * busy 중 disabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  exportApi: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

vi.mock('@shared/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null
}))

import { ExportSkillButton } from '../ExportSkillButton'

const skill = {
  id: 'sk-1',
  name: 'my-skill'
} as unknown as Parameters<typeof ExportSkillButton>[0]['skill']

beforeEach(() => {
  mocks.exportApi.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  ;(window as unknown as Record<string, unknown>).api = {
    skill: { export: mocks.exportApi }
  }
})

describe('ExportSkillButton', () => {
  it('버튼 렌더', () => {
    render(<ExportSkillButton skill={skill} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('성공 → toast.success("...skill 저장됨")', async () => {
    mocks.exportApi.mockResolvedValue({ success: true, data: { path: '/tmp/skill.skill' } })
    render(<ExportSkillButton skill={skill} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
    expect(mocks.toastSuccess.mock.calls[0][0]).toMatch(/my-skill\.skill/)
  })

  it('사용자 취소 (data=null) → toast 호출 안 함', async () => {
    mocks.exportApi.mockResolvedValue({ success: true, data: null })
    render(<ExportSkillButton skill={skill} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mocks.exportApi).toHaveBeenCalled())
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('실패 (success=false) → toast.error', async () => {
    mocks.exportApi.mockResolvedValue({ success: false, message: 'export failed' })
    render(<ExportSkillButton skill={skill} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
  })
})
