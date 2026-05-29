/**
 * widgets/calendar/ui/ScheduleBlock.test.tsx
 *
 * title 노출 + showTime/showDescription 분기 + isTodo + isDone 표식.
 * resizable=true → 상하 핸들 노출 + onResizeStart 호출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#ff0000'
}))

vi.mock('../../model/calendar-utils', () => ({
  DEFAULT_START_HOUR: 0,
  timeToPosition: () => 100,
  scheduleHeight: () => 50,
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

vi.mock('../ScheduleDetailPopover', () => ({
  ScheduleDetailPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { ScheduleBlock } from '../ScheduleBlock'

const baseSchedule = {
  id: 's1',
  title: '회의',
  startAt: new Date('2026-05-29T10:00:00Z'),
  endAt: new Date('2026-05-29T11:00:00Z'),
  description: '설명입니다'
} as unknown as Parameters<typeof ScheduleBlock>[0]['schedule']

describe('ScheduleBlock', () => {
  it('title 노출', () => {
    render(<ScheduleBlock schedule={baseSchedule} workspaceId="ws" hourHeight={40} />)
    expect(screen.getByText('회의')).toBeInTheDocument()
  })

  it('showTime=true → HH:mm ~ HH:mm 노출', () => {
    render(<ScheduleBlock schedule={baseSchedule} workspaceId="ws" hourHeight={40} showTime />)
    expect(screen.getByText(/~/)).toBeInTheDocument()
  })

  it('showDescription=true + description 있음 → 설명 노출', () => {
    render(
      <ScheduleBlock schedule={baseSchedule} workspaceId="ws" hourHeight={40} showDescription />
    )
    expect(screen.getByText('설명입니다')).toBeInTheDocument()
  })

  it('isDone=true → line-through 클래스', () => {
    const done = { ...baseSchedule, isDone: true } as unknown as Parameters<
      typeof ScheduleBlock
    >[0]['schedule']
    const { container } = render(<ScheduleBlock schedule={done} workspaceId="ws" hourHeight={40} />)
    expect(container.innerHTML).toMatch(/line-through/)
  })

  it('resizable=true → 상하 핸들 노출 + 클릭 → onResizeStart', () => {
    const onResizeStart = vi.fn()
    const { container } = render(
      <ScheduleBlock
        schedule={baseSchedule}
        workspaceId="ws"
        hourHeight={40}
        resizable
        onResizeStart={onResizeStart}
      />
    )
    const handles = container.querySelectorAll('.cursor-n-resize, .cursor-s-resize')
    expect(handles.length).toBe(2)
    fireEvent.pointerDown(handles[0])
    expect(onResizeStart).toHaveBeenCalledWith(expect.anything(), baseSchedule, 'top')
  })

  it('resizable=false → 핸들 미노출', () => {
    const { container } = render(
      <ScheduleBlock schedule={baseSchedule} workspaceId="ws" hourHeight={40} />
    )
    expect(container.querySelector('.cursor-n-resize')).toBeNull()
  })
})
