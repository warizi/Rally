/**
 * entities/skill/ui/ToolMultiSelect.test.tsx
 *
 * 트리거 노출 + chip 영역 (선택된 tool 라벨 + 제거 버튼).
 * Popover 내부는 Radix portal — 트리거 + chip 만 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolMultiSelect } from '../ToolMultiSelect'

describe('ToolMultiSelect', () => {
  it('value 0개 → placeholder 노출', () => {
    render(<ToolMultiSelect value={[]} onChange={vi.fn()} placeholder="선택해주세요" />)
    expect(screen.getByText('선택해주세요')).toBeInTheDocument()
  })

  it('value N개 → "N개 선택됨" 표시', () => {
    render(<ToolMultiSelect value={['read', 'search']} onChange={vi.fn()} />)
    expect(screen.getByText('2개 선택됨')).toBeInTheDocument()
  })

  it('readOnly → 트리거 disabled', () => {
    render(<ToolMultiSelect value={[]} onChange={vi.fn()} readOnly />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('chip 노출 — 알려진 tool 은 한국어 라벨', () => {
    render(<ToolMultiSelect value={['read']} onChange={vi.fn()} />)
    expect(screen.getByText('아이템 읽기')).toBeInTheDocument()
  })

  it('chip 노출 — 알려지지 않은 tool 은 value 그대로', () => {
    render(<ToolMultiSelect value={['custom-tool']} onChange={vi.fn()} />)
    expect(screen.getByText('custom-tool')).toBeInTheDocument()
  })

  it('chip X 버튼 클릭 → onChange 로 해당 tool 제거', () => {
    const onChange = vi.fn()
    render(<ToolMultiSelect value={['read', 'search']} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('아이템 읽기 제거'))
    expect(onChange).toHaveBeenCalledWith(['search'])
  })

  it('readOnly → chip X 버튼 미노출', () => {
    render(<ToolMultiSelect value={['read']} onChange={vi.fn()} readOnly />)
    expect(screen.queryByLabelText('아이템 읽기 제거')).not.toBeInTheDocument()
  })
})
