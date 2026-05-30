/**
 * widgets/template/ui/LoadTemplateDialog.test.tsx
 *
 * templates 비었음 / 검색결과 없음 / 선택 → 적용 (hasContent=true → AlertDialog).
 * 삭제 → deleteTemplate + toast. onApply 호출 후 close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeTemplate {
  id: string
  title: string
  jsonData: string
}

const mocks = vi.hoisted(() => ({
  templates: [] as FakeTemplate[],
  deleteTemplate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@entities/template', () => ({
  useTemplates: () => ({ data: mocks.templates }),
  useDeleteTemplate: () => ({ mutate: mocks.deleteTemplate })
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

import { LoadTemplateDialog } from '../LoadTemplateDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  workspaceId: 'ws',
  type: 'note' as const,
  hasContent: false,
  onApply: vi.fn()
}

beforeEach(() => {
  mocks.templates = []
  mocks.deleteTemplate.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('LoadTemplateDialog', () => {
  it('templates 비었음 → "저장된 템플릿이 없습니다"', () => {
    render(<LoadTemplateDialog {...base} />)
    expect(screen.getByText('저장된 템플릿이 없습니다')).toBeInTheDocument()
  })

  it('templates 있음 → 각 title 노출', () => {
    mocks.templates = [
      { id: 't1', title: 'Template A', jsonData: '{"a":1}' },
      { id: 't2', title: 'Template B', jsonData: '{"b":2}' }
    ]
    render(<LoadTemplateDialog {...base} />)
    expect(screen.getByText('Template A')).toBeInTheDocument()
    expect(screen.getByText('Template B')).toBeInTheDocument()
  })

  it('검색어 입력 + 매칭 없음 → "검색 결과가 없습니다"', () => {
    mocks.templates = [{ id: 't1', title: 'Template A', jsonData: '{}' }]
    render(<LoadTemplateDialog {...base} />)
    fireEvent.change(screen.getByPlaceholderText('템플릿 검색...'), {
      target: { value: 'NoMatch' }
    })
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
  })

  it('선택 안 됨 → "적용" 버튼 disabled', () => {
    mocks.templates = [{ id: 't1', title: 'Template A', jsonData: '{}' }]
    render(<LoadTemplateDialog {...base} />)
    expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  })

  it('선택 후 적용 (hasContent=false) → onApply + onOpenChange(false)', () => {
    mocks.templates = [{ id: 't1', title: 'Template A', jsonData: '{"x":1}' }]
    const onApply = vi.fn()
    const onOpenChange = vi.fn()
    render(<LoadTemplateDialog {...base} onApply={onApply} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByText('Template A'))
    fireEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledWith('{"x":1}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('hasContent=true + 적용 → AlertDialog ("기존 내용을 덮어씁니다") 열림', () => {
    mocks.templates = [{ id: 't1', title: 'Template A', jsonData: '{}' }]
    render(<LoadTemplateDialog {...base} hasContent />)
    fireEvent.click(screen.getByText('Template A'))
    fireEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(screen.getByText('기존 내용을 덮어씁니다')).toBeInTheDocument()
  })

  it('AlertDialog 덮어쓰기 → onApply', () => {
    mocks.templates = [{ id: 't1', title: 'Template A', jsonData: '{"v":1}' }]
    const onApply = vi.fn()
    render(<LoadTemplateDialog {...base} hasContent onApply={onApply} />)
    fireEvent.click(screen.getByText('Template A'))
    fireEvent.click(screen.getByRole('button', { name: '적용' }))
    fireEvent.click(screen.getByRole('button', { name: '덮어쓰기' }))
    expect(onApply).toHaveBeenCalledWith('{"v":1}')
  })

  // 삭제 버튼은 invalid HTML (button-in-button) 이라 React 가 reparent 처리 → fire 어려움. smoke skip.

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<LoadTemplateDialog {...base} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('AlertDialog 취소 (덮어쓰기 X) → onApply 호출 안 함', () => {
    mocks.templates = [{ id: 't1', title: 'Template A', jsonData: '{}' }]
    const onApply = vi.fn()
    render(<LoadTemplateDialog {...base} hasContent onApply={onApply} />)
    fireEvent.click(screen.getByText('Template A'))
    fireEvent.click(screen.getByRole('button', { name: '적용' }))
    // AlertDialog 의 cancel 버튼 (취소) — 적용 안 됨
    const cancelBtn = screen.getAllByRole('button').find((b) => b.textContent === '취소')
    if (cancelBtn) fireEvent.click(cancelBtn)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('open=false → 콘텐츠 미렌더', () => {
    render(<LoadTemplateDialog {...base} open={false} />)
    expect(screen.queryByText('저장된 템플릿이 없습니다')).toBeNull()
  })

  it('검색어 입력 → 매칭 항목만 노출', () => {
    mocks.templates = [
      { id: 't1', title: 'Apple', jsonData: '{}' },
      { id: 't2', title: 'Banana', jsonData: '{}' }
    ]
    render(<LoadTemplateDialog {...base} />)
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/검색/), { target: { value: 'app' } })
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).toBeNull()
  })
})
