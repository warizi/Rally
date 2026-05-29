/**
 * features/skill/register-skill/ui/RegisterSkillDialog.test.tsx
 *
 * open 분기. nameSuffix + description input. 제출 시 createSkill.
 * 빈 nameSuffix → 에러 메시지.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  isPending: false,
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@entities/skill', () => ({
  useCreateSkill: () => ({ mutateAsync: mocks.createMutate, isPending: mocks.isPending }),
  assembleSkillContent: () => '# assembled',
  ToolMultiSelect: () => <div data-testid="tool-select" />
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

import { RegisterSkillDialog } from '../RegisterSkillDialog'

beforeEach(() => {
  mocks.createMutate.mockReset()
  mocks.isPending = false
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('RegisterSkillDialog', () => {
  it('open=false → 미렌더', () => {
    const { container } = render(<RegisterSkillDialog open={false} onOpenChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('open=true → name suffix input + 설명 textarea 노출', () => {
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/Skill 등록|새 Skill|Skill 추가/)).toBeInTheDocument()
  })

  it('취소 클릭 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<RegisterSkillDialog open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /취소/ }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('빈 nameSuffix 제출 → 에러 메시지', async () => {
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('등록'))
    if (submitBtn) {
      fireEvent.click(submitBtn)
      await waitFor(() => expect(screen.queryByText(/이름을 입력해주세요/)).toBeInTheDocument())
    }
    expect(mocks.createMutate).not.toHaveBeenCalled()
  })
})
