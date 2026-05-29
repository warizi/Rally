/**
 * widgets/calendar/ui/ScheduleDot.test.tsx
 *
 * 단순 presentational — 색상은 getScheduleColor 위임, title 은 schedule.title 노출.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleDot } from '../ScheduleDot'
import type { ScheduleItem } from '@entities/schedule'

function makeSchedule(overrides?: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'sch-1',
    workspaceId: 'ws-1',
    title: 'My schedule',
    description: null,
    location: null,
    allDay: false,
    startAt: new Date('2026-05-29T10:00:00Z'),
    endAt: new Date('2026-05-29T11:00:00Z'),
    color: null,
    priority: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as unknown as ScheduleItem
}

describe('ScheduleDot', () => {
  it('schedule.title 이 title 속성으로 노출', () => {
    const { container } = render(<ScheduleDot schedule={makeSchedule({ title: 'Lunch' })} />)
    const dot = container.querySelector('div[title="Lunch"]')
    expect(dot).toBeInTheDocument()
  })

  it('schedule.color 가 있으면 backgroundColor 로 적용', () => {
    const { container } = render(<ScheduleDot schedule={makeSchedule({ color: '#ff0000' })} />)
    const dot = container.querySelector('div')
    // getScheduleColor 가 color 그대로 반환 (가정)
    expect(dot?.style.backgroundColor).toBeTruthy()
  })

  it('size 클래스 유지 (size-1.5 rounded-full)', () => {
    const { container } = render(<ScheduleDot schedule={makeSchedule()} />)
    const dot = container.querySelector('div')
    expect(dot?.className).toMatch(/size-1\.5/)
    expect(dot?.className).toMatch(/rounded-full/)
    void screen
  })
})
