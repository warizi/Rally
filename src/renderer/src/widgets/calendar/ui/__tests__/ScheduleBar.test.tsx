/**
 * widgets/calendar/ui/ScheduleBar.test.tsx
 *
 * isTodo + isDone 분기 → ☑/☐ + line-through.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ScheduleItem } from '@entities/schedule'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))
vi.mock('../ScheduleDetailPopover', () => ({
  ScheduleDetailPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { ScheduleBar } from '../ScheduleBar'

function sch(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 's-1',
    title: 'Test',
    startAt: new Date(),
    endAt: new Date(),
    color: '#ff0000',
    allDay: false,
    isDone: false,
    ...over
  } as unknown as ScheduleItem
}

describe('ScheduleBar', () => {
  it('일반 schedule → 제목 노출, 체크박스 없음', () => {
    const { container } = render(
      <ScheduleBar
        schedule={sch()}
        workspaceId="ws-1"
        startCol={0}
        span={1}
        lane={0}
        isStart
        isEnd
      />
    )
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(container.textContent).not.toContain('☑')
    expect(container.textContent).not.toContain('☐')
  })

  it('isTodo + 미완료 → ☐ 체크박스', () => {
    const { container } = render(
      <ScheduleBar
        schedule={sch({ id: 'todo:t-1', isDone: false })}
        workspaceId="ws-1"
        startCol={0}
        span={1}
        lane={0}
        isStart
        isEnd
      />
    )
    expect(container.textContent).toContain('☐')
  })

  it('isTodo + 완료 → ☑ 체크박스 + line-through', () => {
    const { container } = render(
      <ScheduleBar
        schedule={sch({ id: 'todo:t-1', isDone: true })}
        workspaceId="ws-1"
        startCol={0}
        span={1}
        lane={0}
        isStart
        isEnd
      />
    )
    expect(container.textContent).toContain('☑')
    expect(container.querySelector('.line-through')).toBeInTheDocument()
  })
})
