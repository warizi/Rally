/**
 * widgets/tag/ui/TagColorPicker.test.tsx
 *
 * 12 색상 프리셋 + 선택 시 onChange + 일치 시 Check 아이콘.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagColorPicker } from '../TagColorPicker'

describe('TagColorPicker', () => {
  it('12개 색상 버튼 렌더', () => {
    render(<TagColorPicker value="#ffb3b3" onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(12)
  })

  it('색상 클릭 → onChange(색상)', () => {
    const fn = vi.fn()
    render(<TagColorPicker value="" onChange={fn} />)
    fireEvent.click(screen.getByTitle('빨강'))
    expect(fn).toHaveBeenCalledWith('#ffb3b3')
  })

  it('value 일치 → Check (lucide-check svg) 노출', () => {
    const { container } = render(<TagColorPicker value="#ffb3b3" onChange={vi.fn()} />)
    expect(container.querySelector('svg.lucide-check')).toBeInTheDocument()
  })

  it('value 불일치 → Check 미노출', () => {
    const { container } = render(<TagColorPicker value="#000000" onChange={vi.fn()} />)
    expect(container.querySelector('svg.lucide-check')).toBeNull()
  })
})
