/**
 * widgets/calendar/ui/ColorPicker.test.tsx
 *
 * SCHEDULE_COLOR_PRESETS 8개 버튼 렌더 + 선택 시 onChange.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorPicker } from '../ColorPicker'
import { SCHEDULE_COLOR_PRESETS } from '../../model/schedule-color'

describe('ColorPicker', () => {
  it('프리셋 갯수만큼 버튼 렌더', () => {
    render(<ColorPicker value={null} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(SCHEDULE_COLOR_PRESETS.length)
  })

  it('각 버튼 클릭 → 해당 color 로 onChange 호출', () => {
    const fn = vi.fn()
    render(<ColorPicker value={null} onChange={fn} />)
    const target = SCHEDULE_COLOR_PRESETS[1]
    fireEvent.click(screen.getByTitle(target.label))
    expect(fn).toHaveBeenCalledWith(target.value)
  })

  it('현재 value 와 일치하는 버튼은 Check 아이콘 표시', () => {
    // SVG 의 lucide-check icon class 로 식별
    const colorValue = SCHEDULE_COLOR_PRESETS.find((p) => p.value !== null)?.value ?? null
    const { container } = render(<ColorPicker value={colorValue} onChange={vi.fn()} />)
    expect(container.querySelector('svg.lucide-check')).toBeInTheDocument()
  })
})
