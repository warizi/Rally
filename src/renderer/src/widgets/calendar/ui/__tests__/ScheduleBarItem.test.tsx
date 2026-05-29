/**
 * widgets/calendar/ui/ScheduleBarItem.test.tsx
 *
 * title 노출 + isTodo + isDone 표식 + pointerDown 시 onGrab.
 * wrapperClassName 분기.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))

vi.mock('../../model/calendar-constants', () => ({
  BAR_GAP: 2
}))

vi.mock('../../model/schedule-style', () => ({
  getItemStyle: () => ({ backgroundColor: 'red' })
}))

vi.mock('../../model/calendar-predicates', () => ({
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

vi.mock('../ScheduleDetailPopover', () => ({
  ScheduleDetailPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { ScheduleBarItem } from '../ScheduleBarItem'

const baseProps = {
  schedule: {
    id: 's1',
    title: '회의',
    isDone: false
  } as unknown as Parameters<typeof ScheduleBarItem>[0]['schedule'],
  workspaceId: 'ws',
  startCol: 0,
  span: 3,
  lane: 0,
  isStart: true,
  isEnd: true,
  barHeight: 20,
  draggableId: 'd1',
  onGrab: vi.fn()
}

describe('ScheduleBarItem', () => {
  it('title 노출', () => {
    render(<ScheduleBarItem {...baseProps} />)
    expect(screen.getByText('회의')).toBeInTheDocument()
  })

  it('isTodo + isDone → ☑ 노출 + line-through', () => {
    const sched = {
      id: 's1',
      title: 'T',
      isDone: true,
      type: 'todo'
    } as unknown as Parameters<typeof ScheduleBarItem>[0]['schedule']
    const { container } = render(<ScheduleBarItem {...baseProps} schedule={sched} />)
    expect(screen.getByText('☑')).toBeInTheDocument()
    expect(container.innerHTML).toMatch(/line-through/)
  })

  it('isTodo + !isDone → ☐ 노출', () => {
    const sched = {
      id: 's1',
      title: 'T',
      isDone: false,
      type: 'todo'
    } as unknown as Parameters<typeof ScheduleBarItem>[0]['schedule']
    render(<ScheduleBarItem {...baseProps} schedule={sched} />)
    expect(screen.getByText('☐')).toBeInTheDocument()
  })

  it('pointerDown → onGrab(offset, width)', () => {
    const onGrab = vi.fn()
    const { container } = render(<ScheduleBarItem {...baseProps} onGrab={onGrab} />)
    const inner = container.querySelector('.absolute')!
    // Override getBoundingClientRect to return predictable rect
    inner.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 300,
        top: 0,
        bottom: 20,
        width: 300,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
    fireEvent.pointerDown(inner, { clientX: 150 })
    // colWidth = 300 / 3 = 100, offset = floor(150/100) = 1
    expect(onGrab).toHaveBeenCalledWith(1, 300)
  })

  it('wrapperClassName → wrap div 노출', () => {
    const { container } = render(<ScheduleBarItem {...baseProps} wrapperClassName="wrapper-x" />)
    expect(container.querySelector('.wrapper-x')).toBeInTheDocument()
  })

  it('wrapperClassName 없음 → 추가 wrap 없이 직접 inner', () => {
    const { container } = render(<ScheduleBarItem {...baseProps} />)
    expect(container.querySelector('.wrapper-x')).toBeNull()
  })

  it('isStart=true → rounded-l-sm 클래스', () => {
    const { container } = render(<ScheduleBarItem {...baseProps} isStart={true} isEnd={false} />)
    expect(container.innerHTML).toMatch(/rounded-l-sm/)
    expect(container.innerHTML).not.toMatch(/rounded-r-sm/)
  })
})
