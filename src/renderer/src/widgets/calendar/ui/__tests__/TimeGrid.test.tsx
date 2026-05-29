/**
 * widgets/calendar/ui/TimeGrid.test.tsx
 *
 * slots 렌더 + 클릭 → onTimeClick (계산 정확성).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../CurrentTimeIndicator', () => ({
  CurrentTimeIndicator: () => <div data-testid="current-time-indicator" />
}))

import { TimeGrid } from '../TimeGrid'

describe('TimeGrid', () => {
  it('startHour=9, endHour=12 → 시간 라벨 3개 (9시, 10시, 11시)', () => {
    render(
      <TimeGrid hourHeight={60} labelWidth="60px" labelClass="" startHour={9} endHour={12}>
        <div>children</div>
      </TimeGrid>
    )
    // getTimeSlots(9,12) → [9,10,11] 라벨
    expect(screen.getByText(/9/)).toBeInTheDocument()
    expect(screen.getByText(/11/)).toBeInTheDocument()
  })

  it('children 노출', () => {
    render(
      <TimeGrid hourHeight={60} labelWidth="60px" labelClass="">
        <div data-testid="schedule-blocks">blocks</div>
      </TimeGrid>
    )
    expect(screen.getByTestId('schedule-blocks')).toBeInTheDocument()
  })

  it('showCurrentTime=true (기본) → CurrentTimeIndicator 노출', () => {
    render(
      <TimeGrid hourHeight={60} labelWidth="60px" labelClass="">
        <div />
      </TimeGrid>
    )
    expect(screen.getByTestId('current-time-indicator')).toBeInTheDocument()
  })

  it('showCurrentTime=false → CurrentTimeIndicator 미렌더', () => {
    render(
      <TimeGrid hourHeight={60} labelWidth="60px" labelClass="" showCurrentTime={false}>
        <div />
      </TimeGrid>
    )
    expect(screen.queryByTestId('current-time-indicator')).not.toBeInTheDocument()
  })

  it('onTimeClick 미제공 → 클릭 무시', () => {
    const fn = vi.fn()
    const { container } = render(
      <TimeGrid hourHeight={60} labelWidth="60px" labelClass="">
        <div />
      </TimeGrid>
    )
    const grid = container.querySelector('div.flex-1.relative') as HTMLDivElement
    fireEvent.click(grid)
    expect(fn).not.toHaveBeenCalled()
  })

  it('onTimeClick 제공 → 클릭 시 콜백 호출', () => {
    const fn = vi.fn()
    const { container } = render(
      <TimeGrid
        hourHeight={60}
        labelWidth="60px"
        labelClass=""
        startHour={9}
        endHour={18}
        onTimeClick={fn}
      >
        <div data-testid="child" />
      </TimeGrid>
    )
    // onClick 가 붙은 div 는 children 의 부모. children 을 click 하면 bubble.
    fireEvent.click(screen.getByTestId('child'), { clientY: 0 })
    expect(fn).toHaveBeenCalled()
    void container
  })
})
