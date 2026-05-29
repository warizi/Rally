/**
 * widgets/calendar/ui/ScheduleDragOverlay.test.tsx
 *
 * activeSchedule=null → null. 분기 type=bar/single/block — 다른 출력.
 * todo 아이콘 ☑ 표시.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  )
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#ff0000'
}))

vi.mock('../../model/calendar-utils', () => ({
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

import { ScheduleDragOverlay } from '../ScheduleDragOverlay'

const baseSchedule = {
  id: 's1',
  title: '회의',
  startAt: new Date('2026-05-29T10:00:00Z'),
  endAt: new Date('2026-05-29T11:00:00Z')
} as unknown as Parameters<typeof ScheduleDragOverlay>[0]['activeSchedule']

describe('ScheduleDragOverlay', () => {
  it('activeSchedule=null → null 반환', () => {
    const { container } = render(<ScheduleDragOverlay activeSchedule={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('block (기본) → title + 시간 노출', () => {
    render(<ScheduleDragOverlay activeSchedule={baseSchedule} />)
    expect(screen.getByText('회의')).toBeInTheDocument()
    expect(screen.getByText(/~/)).toBeInTheDocument()
  })

  it('type=bar → bar 스타일 div + title 노출', () => {
    render(<ScheduleDragOverlay activeSchedule={baseSchedule} activeType="bar" />)
    expect(screen.getByText('회의')).toBeInTheDocument()
  })

  it('type=single → single 스타일 + title', () => {
    render(<ScheduleDragOverlay activeSchedule={baseSchedule} activeType="single" />)
    expect(screen.getByText('회의')).toBeInTheDocument()
  })

  it('isTodo=true → ☑ 아이콘 노출', () => {
    const todoSched = { ...baseSchedule, type: 'todo' } as unknown as Parameters<
      typeof ScheduleDragOverlay
    >[0]['activeSchedule']
    render(<ScheduleDragOverlay activeSchedule={todoSched} activeType="bar" />)
    expect(screen.getByText('☑')).toBeInTheDocument()
  })
})
