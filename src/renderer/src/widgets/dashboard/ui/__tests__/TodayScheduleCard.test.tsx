/**
 * widgets/dashboard/ui/TodayScheduleCard.test.tsx
 *
 * useSchedulesByWorkspace mock + 오늘/다가오는 분류 + allDay Badge + relative date.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  schedules: [] as Array<{
    id: string
    title: string
    startAt: Date
    endAt: Date
    allDay: boolean
    color: string | null
  }>,
  openTab: vi.fn()
}))

vi.mock('@entities/schedule', () => ({
  useSchedulesByWorkspace: () => ({ data: mocks.schedules, isLoading: false })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

import { TodayScheduleCard } from '../TodayScheduleCard'

const NOW = new Date()
NOW.setHours(12, 0, 0, 0)
const TOMORROW = new Date(NOW)
TOMORROW.setDate(TOMORROW.getDate() + 1)
const DAY_AFTER = new Date(NOW)
DAY_AFTER.setDate(DAY_AFTER.getDate() + 2)

beforeEach(() => {
  mocks.schedules = []
  mocks.openTab.mockClear()
})

describe('TodayScheduleCard', () => {
  it('empty → "오늘 일정이 없습니다"', () => {
    render(<TodayScheduleCard workspaceId="ws-1" />)
    expect(screen.getByText('오늘 일정이 없습니다')).toBeInTheDocument()
  })

  it('오늘 일정 → 시간 + 제목 노출', () => {
    mocks.schedules = [
      {
        id: 's1',
        title: 'Meeting',
        startAt: new Date(NOW.getTime() + 1000 * 60 * 60),
        endAt: new Date(NOW.getTime() + 1000 * 60 * 90),
        allDay: false,
        color: '#f00'
      }
    ]
    render(<TodayScheduleCard workspaceId="ws-1" />)
    expect(screen.getByText('Meeting')).toBeInTheDocument()
  })

  it('allDay → Badge "종일" 노출', () => {
    mocks.schedules = [
      {
        id: 's1',
        title: '종일이벤트',
        startAt: NOW,
        endAt: NOW,
        allDay: true,
        color: null
      }
    ]
    render(<TodayScheduleCard workspaceId="ws-1" />)
    expect(screen.getByText('종일')).toBeInTheDocument()
  })

  it('다가오는 일정 → 별도 섹션 + "내일"/"모레" 라벨', () => {
    mocks.schedules = [
      { id: 's1', title: '내일것', startAt: TOMORROW, endAt: TOMORROW, allDay: false, color: null },
      {
        id: 's2',
        title: '모레것',
        startAt: DAY_AFTER,
        endAt: DAY_AFTER,
        allDay: false,
        color: null
      }
    ]
    render(<TodayScheduleCard workspaceId="ws-1" />)
    expect(screen.getByText('다가오는 일정')).toBeInTheDocument()
    expect(screen.getByText('내일')).toBeInTheDocument()
    expect(screen.getByText('모레')).toBeInTheDocument()
  })

  it('일정 클릭 → openTab(calendar, scheduleId)', () => {
    mocks.schedules = [
      {
        id: 's1',
        title: '클릭됨',
        startAt: NOW,
        endAt: NOW,
        allDay: false,
        color: null
      }
    ]
    render(<TodayScheduleCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('클릭됨'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'calendar',
        searchParams: { scheduleId: 's1' }
      })
    )
  })
})
