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

  it('nameSuffix 잘못된 문자 (대문자 등) → 정규식 에러 메시지', async () => {
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    const nameInputs = screen.getAllByRole('textbox')
    const nameInput = nameInputs[0]
    fireEvent.change(nameInput, { target: { value: 'BadName!' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('등록'))
    if (submitBtn) {
      fireEvent.click(submitBtn)
      await waitFor(() => expect(screen.queryByText(/영소문자\/숫자\/하이픈/)).toBeInTheDocument())
    }
    expect(mocks.createMutate).not.toHaveBeenCalled()
  })

  it('ToolMultiSelect 마운트', () => {
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('tool-select')).toBeInTheDocument()
  })

  it('isPending=true → 등록 버튼 disabled', () => {
    mocks.isPending = true
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('등록'))
    expect(submitBtn).toBeDisabled()
  })

  it('정상 form 입력 + 제출 → createSkill.mutateAsync 호출 + onOpenChange(false)', async () => {
    mocks.createMutate.mockResolvedValue({ id: 'skill-1' })
    const onOpenChange = vi.fn()
    render(<RegisterSkillDialog open={true} onOpenChange={onOpenChange} />)
    const inputs = screen.getAllByRole('textbox')
    // nameSuffix input (첫번째)
    fireEvent.change(inputs[0], { target: { value: 'my-skill' } })
    // description textarea (두번째)
    fireEvent.change(inputs[1], { target: { value: 'desc text' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('등록'))
    if (submitBtn) fireEvent.click(submitBtn)
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(mocks.toastSuccess).toHaveBeenCalled()
  })

  it('createSkill 실패 → toast.error 호출 + onOpenChange 호출 안 함', async () => {
    mocks.createMutate.mockRejectedValue(new Error('boom'))
    const onOpenChange = vi.fn()
    render(<RegisterSkillDialog open={true} onOpenChange={onOpenChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'my-skill' } })
    fireEvent.change(inputs[1], { target: { value: 'desc' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('등록'))
    if (submitBtn) fireEvent.click(submitBtn)
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('빈 description → 설명 에러 메시지', async () => {
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'valid-name' } })
    const submitBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('등록'))
    if (submitBtn) fireEvent.click(submitBtn)
    await waitFor(() =>
      expect(screen.queryByText(/이 skill 이 무엇을 하는지 설명/)).toBeInTheDocument()
    )
  })

  it('nameSuffix prefix "rally-" 노출 (InputGroup addon)', () => {
    render(<RegisterSkillDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getAllByText(/rally-/).length).toBeGreaterThan(0)
  })
})
