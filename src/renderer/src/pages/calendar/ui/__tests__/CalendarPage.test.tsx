/**
 * pages/calendar/ui/CalendarPage.test.tsx
 *
 * 기본 렌더 (workspaceId 있음 → 캘린더 헤더 + view) / 없음 → 빈 헤더.
 * viewType 분기 (month / week / day) → 해당 view 렌더.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  schedules: [] as Array<{ id: string; startDate?: Date | null; dueDate?: Date | null }>,
  todos: [] as Array<{ id: string; startDate?: Date | null; dueDate?: Date | null }>,
  viewType: 'month' as 'month' | 'week' | 'day',
  currentDate: new Date('2026-05-29'),
  selectedDate: new Date('2026-05-29'),
  dateRange: { start: new Date('2026-05-01'), end: new Date('2026-05-31') },
  navigateTab: vi.fn(),
  tabSearchParams: undefined as Record<string, string> | undefined
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    sel: (s: {
      tabs: Record<string, { searchParams?: Record<string, string> }>
      navigateTab: typeof mocks.navigateTab
    }) => unknown
  ) =>
    sel({
      tabs: { t1: { searchParams: mocks.tabSearchParams } },
      navigateTab: mocks.navigateTab
    })
}))

vi.mock('@entities/schedule', () => ({
  useSchedulesByWorkspace: () => ({ data: mocks.schedules })
}))

vi.mock('@entities/todo', () => ({
  useTodosByDateRange: () => ({ data: mocks.todos })
}))

vi.mock('@widgets/todo', () => ({
  RecurringTodoSection: () => <div data-testid="recurring-section" />
}))

vi.mock('@shared/ui/tab-container', () => ({
  TabContainer: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  )
}))

vi.mock('@shared/ui/tab-header', () => ({
  default: ({ title, buttons }: { title: string; buttons?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {buttons}
    </header>
  )
}))

vi.mock('@widgets/calendar', () => ({
  CalendarViewToolbar: ({ viewType }: { viewType: string }) => (
    <div data-testid="view-toolbar">{viewType}</div>
  ),
  CalendarNavigation: () => <div data-testid="nav" />,
  MonthView: () => <div data-testid="month-view" />,
  WeekView: () => <div data-testid="week-view" />,
  DayView: () => <div data-testid="day-view" />,
  ScheduleFormDialog: () => <div data-testid="schedule-form" />,
  useCalendar: () => ({
    viewType: mocks.viewType,
    setViewType: vi.fn(),
    currentDate: mocks.currentDate,
    selectedDate: mocks.selectedDate,
    setSelectedDate: vi.fn(),
    selectDate: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
    goToday: vi.fn(),
    dateRange: mocks.dateRange
  })
}))

import { CalendarPage } from '../CalendarPage'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.schedules = []
  mocks.todos = []
  mocks.viewType = 'month'
  mocks.tabSearchParams = undefined
  mocks.navigateTab.mockReset()
})

describe('CalendarPage', () => {
  it('타이틀 "캘린더" + workspaceId 있음 → toolbar/dialog 노출 (responsive 중복)', () => {
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByText('캘린더')).toBeInTheDocument()
    expect(screen.getAllByTestId('schedule-form').length).toBeGreaterThan(0)
  })

  it('viewType=month → MonthView 렌더', () => {
    mocks.viewType = 'month'
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByTestId('month-view')).toBeInTheDocument()
  })

  it('viewType=week → WeekView 렌더', () => {
    mocks.viewType = 'week'
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByTestId('week-view')).toBeInTheDocument()
  })

  it('viewType=day → DayView 렌더', () => {
    mocks.viewType = 'day'
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByTestId('day-view')).toBeInTheDocument()
  })

  it('workspaceId=null → buttons 미렌더 (헤더만)', () => {
    mocks.workspaceId = null
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByText('캘린더')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-form')).not.toBeInTheDocument()
  })

  it('workspaceId=null → "워크스페이스를 선택해주세요" 메시지', () => {
    mocks.workspaceId = null
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByText('워크스페이스를 선택해주세요')).toBeInTheDocument()
  })

  it('schedules + todos 모두 비어있음 → "이 범위에 일정이 없어요" 빈 안내', () => {
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByText(/이 범위에 일정이 없어요/)).toBeInTheDocument()
  })

  it('schedules 있음 → 빈 안내 미노출', () => {
    mocks.schedules = [{ id: 's1' }]
    render(<CalendarPage tabId="t1" />)
    expect(screen.queryByText(/이 범위에 일정이 없어요/)).toBeNull()
  })

  it('viewType=day → DayView + RecurringTodoSection 노출', () => {
    mocks.viewType = 'day'
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByTestId('day-view')).toBeInTheDocument()
  })

  it('tabSearchParams.showTodos="false" → 표시 모드 변경 (CheckSquare button 노출)', () => {
    mocks.tabSearchParams = { showTodos: 'false' }
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByText('캘린더')).toBeInTheDocument()
  })

  it('todos + schedules 모두 있음 → 빈 안내 미노출 + month-view 렌더', () => {
    mocks.schedules = [{ id: 's1' }]
    mocks.todos = [{ id: 't1', startDate: new Date(), dueDate: new Date() }]
    render(<CalendarPage tabId="t1" />)
    expect(screen.queryByText(/이 범위에 일정이 없어요/)).toBeNull()
    expect(screen.getByTestId('month-view')).toBeInTheDocument()
  })

  it('todos 만 있음 (schedules 비어있음, showTodos=true 기본) → 빈 안내 미노출', () => {
    mocks.todos = [{ id: 't1', startDate: new Date(), dueDate: new Date() }]
    render(<CalendarPage tabId="t1" />)
    expect(screen.queryByText(/이 범위에 일정이 없어요/)).toBeNull()
  })

  it('showTodos="false" + todos 만 있음 → 빈 안내 노출 (todos 무시)', () => {
    mocks.tabSearchParams = { showTodos: 'false' }
    mocks.todos = [{ id: 't1', startDate: new Date(), dueDate: new Date() }]
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByText(/이 범위에 일정이 없어요/)).toBeInTheDocument()
  })

  it('todos 의 startDate/dueDate null → schedules 로 변환 안 됨 (필터링)', () => {
    mocks.todos = [
      { id: 't1', startDate: null, dueDate: null },
      { id: 't2', startDate: new Date(), dueDate: new Date() }
    ]
    render(<CalendarPage tabId="t1" />)
    // 적어도 t2 가 있으므로 빈 안내 미노출
    expect(screen.queryByText(/이 범위에 일정이 없어요/)).toBeNull()
  })

  it('viewType="day" 추가 시 RecurringTodoSection 노출 (DayView 가 recurringSection prop 받음)', () => {
    mocks.viewType = 'day'
    render(<CalendarPage tabId="t1" />)
    expect(screen.getByTestId('day-view')).toBeInTheDocument()
  })
})
