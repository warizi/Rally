/**
 * widgets/calendar/ui/ScheduleDetailPopover.test.tsx
 *
 * 기본 정보 (title/dateRange/location/description) 노출.
 * isTodo + isDone 표식. reminder 정보 노출. linked entity 노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@entities/entity-link', () => ({
  useLinkedEntities: () => ({ data: [] })
}))

vi.mock('@entities/reminder', () => ({
  useReminders: () => ({ data: [] }),
  REMINDER_OFFSETS: [
    { value: 600000, label: '10분 전' },
    { value: 1800000, label: '30분 전' }
  ]
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: () => vi.fn()
}))

vi.mock('@shared/lib/entity-link', () => ({
  ENTITY_TYPE_ICON: {}
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#ff0000'
}))

vi.mock('../../model/calendar-utils', () => ({
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

vi.mock('../ScheduleFormDialog', () => ({
  ScheduleFormDialog: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="form-dialog" /> : null
}))

vi.mock('../DeleteScheduleDialog', () => ({
  DeleteScheduleDialog: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="delete-dialog" /> : null
}))

vi.mock('@/widgets/entity-link', () => ({
  LinkEntityPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OpenAllSubmenu: () => null
}))

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadgePair: () => <span data-testid="author" />
}))

import { ScheduleDetailPopover } from '../ScheduleDetailPopover'

const baseSchedule = {
  id: 's1',
  title: '회의',
  startAt: new Date('2026-05-29T10:00:00Z'),
  endAt: new Date('2026-05-29T11:00:00Z'),
  allDay: false,
  description: '설명',
  location: '회의실 A',
  isDone: false,
  type: 'schedule',
  createdBy: 'me',
  createdById: 'u1',
  createdAt: new Date(),
  updatedBy: 'me',
  updatedById: 'u1',
  updatedAt: new Date()
} as unknown as Parameters<typeof ScheduleDetailPopover>[0]['schedule']

describe('ScheduleDetailPopover', () => {
  it('title + location + description 노출', () => {
    render(
      <ScheduleDetailPopover schedule={baseSchedule} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    expect(screen.getByText('회의')).toBeInTheDocument()
    expect(screen.getByText('회의실 A')).toBeInTheDocument()
    expect(screen.getByText('설명')).toBeInTheDocument()
  })

  it('schedule 타입 → "할 일" 뱃지 미노출', () => {
    render(
      <ScheduleDetailPopover schedule={baseSchedule} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    expect(screen.queryByText('할 일')).not.toBeInTheDocument()
  })

  it('todo 타입 → "할 일" 뱃지 노출', () => {
    const todoSchedule = {
      ...baseSchedule,
      type: 'todo'
    } as unknown as Parameters<typeof ScheduleDetailPopover>[0]['schedule']
    render(
      <ScheduleDetailPopover schedule={todoSchedule} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    expect(screen.getByText('할 일')).toBeInTheDocument()
  })

  it('isDone=true → line-through 클래스', () => {
    const done = { ...baseSchedule, isDone: true } as unknown as Parameters<
      typeof ScheduleDetailPopover
    >[0]['schedule']
    const { container } = render(
      <ScheduleDetailPopover schedule={done} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    expect(container.innerHTML).toMatch(/line-through/)
  })

  it('allDay=true → 시간 미노출 (Clock 아이콘 없음)', () => {
    const allDay = { ...baseSchedule, allDay: true } as unknown as Parameters<
      typeof ScheduleDetailPopover
    >[0]['schedule']
    const { container } = render(
      <ScheduleDetailPopover schedule={allDay} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    // 시간 (HH:mm) 미노출
    expect(container.innerHTML).not.toMatch(/10:00.*11:00/)
  })

  it('description 없음 → 설명 텍스트 미노출', () => {
    const noDesc = {
      ...baseSchedule,
      description: null
    } as unknown as Parameters<typeof ScheduleDetailPopover>[0]['schedule']
    render(
      <ScheduleDetailPopover schedule={noDesc} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    expect(screen.queryByText('설명')).toBeNull()
  })

  it('location 없음 → 위치 텍스트 미노출', () => {
    const noLoc = {
      ...baseSchedule,
      location: null
    } as unknown as Parameters<typeof ScheduleDetailPopover>[0]['schedule']
    render(
      <ScheduleDetailPopover schedule={noLoc} workspaceId="ws">
        <button>trigger</button>
      </ScheduleDetailPopover>
    )
    expect(screen.queryByText('회의실 A')).toBeNull()
  })

  it('children (custom trigger) 렌더', () => {
    render(
      <ScheduleDetailPopover schedule={baseSchedule} workspaceId="ws">
        <button data-testid="custom-trigger">cl</button>
      </ScheduleDetailPopover>
    )
    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument()
  })
})
