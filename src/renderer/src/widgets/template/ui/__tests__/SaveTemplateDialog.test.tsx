/**
 * widgets/template/ui/SaveTemplateDialog.test.tsx
 *
 * title 입력 후 저장 → createTemplate({workspaceId, type, title, jsonData}).
 * 성공 → toast.success + onOpenChange(false). 실패 → toast.error.
 * 빈 title → 에러. isPending → disabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createTemplate: vi.fn(),
  isPending: false,
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@entities/template', () => ({
  useCreateTemplate: () => ({ mutate: mocks.createTemplate, isPending: mocks.isPending })
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

import { SaveTemplateDialog } from '../SaveTemplateDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  workspaceId: 'ws',
  type: 'note' as const,
  jsonData: '{"x":1}'
}

beforeEach(() => {
  mocks.createTemplate.mockReset()
  mocks.isPending = false
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('SaveTemplateDialog', () => {
  it('타이틀 + placeholder 노출', () => {
    render(<SaveTemplateDialog {...base} />)
    expect(screen.getByText('템플릿 저장')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('템플릿 이름')).toBeInTheDocument()
  })

  it('이름 입력 후 저장 → createTemplate + 성공 → toast.success + onOpenChange(false)', async () => {
    const onOpenChange = vi.fn()
    mocks.createTemplate.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(<SaveTemplateDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.change(screen.getByPlaceholderText('템플릿 이름'), { target: { value: 'T1' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(mocks.createTemplate).toHaveBeenCalledWith(
        { workspaceId: 'ws', type: 'note', title: 'T1', jsonData: '{"x":1}' },
        expect.any(Object)
      )
    )
    expect(mocks.toastSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('createTemplate 실패 → toast.error', async () => {
    mocks.createTemplate.mockImplementation((_arg, opts) => opts?.onError?.(new Error('boom')))
    render(<SaveTemplateDialog {...base} />)
    fireEvent.change(screen.getByPlaceholderText('템플릿 이름'), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
    expect(mocks.toastError.mock.calls[0][0]).toMatch(/boom/)
  })

  it('빈 title → 에러 메시지', async () => {
    render(<SaveTemplateDialog {...base} />)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.getByText('제목을 입력해주세요')).toBeInTheDocument())
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it('isPending → "저장 중..." disabled', () => {
    mocks.isPending = true
    render(<SaveTemplateDialog {...base} />)
    expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<SaveTemplateDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
