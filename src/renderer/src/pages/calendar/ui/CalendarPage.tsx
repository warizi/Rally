import { useMemo } from 'react'
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from 'date-fns'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useSchedulesByWorkspace, type ScheduleItem } from '@entities/schedule'
import { useTodosByWorkspace, type TodoItem } from '@entities/todo'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Button } from '@shared/ui/button'
import { CalendarViewToolbar } from '@widgets/calendar'
import {
  CalendarNavigation,
  MonthView,
  WeekView,
  DayView,
  ScheduleFormDialog,
  useCalendar,
  type CalendarViewType
} from '@features/schedule/manage-schedule'

function todoToScheduleItem(todo: TodoItem): ScheduleItem {
  const start = todo.startDate ?? todo.dueDate!
  const end = todo.dueDate ?? todo.startDate!

  // 시간이 00:00인 경우(기존 데이터) → 09:00 기본값
  const startAt = new Date(start)
  const endAt = new Date(end)

  if (startAt.getHours() === 0 && startAt.getMinutes() === 0) {
    startAt.setHours(9, 0, 0, 0)
  }
  if (
    (endAt.getHours() === 0 && endAt.getMinutes() === 0) ||
    (endAt.getHours() === 23 && endAt.getMinutes() === 59)
  ) {
    endAt.setHours(10, 0, 0, 0)
  }

  return {
    id: `todo:${todo.id}`,
    workspaceId: todo.workspaceId,
    title: todo.title,
    description: todo.description || null,
    location: null,
    allDay: false,
    startAt,
    endAt,
    color: null,
    priority: todo.priority,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt
  }
}

interface Props {
  tabId?: string
}

export function CalendarPage({ tabId }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const tabSearchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)

  const calendar = useCalendar({
    initialViewType: (tabSearchParams?.viewType as CalendarViewType) || 'month',
    initialDate: tabSearchParams?.currentDate
  })

  const { data: schedules = [] } = useSchedulesByWorkspace(workspaceId, calendar.dateRange)
  const { data: todos = [] } = useTodosByWorkspace(workspaceId, { filter: 'active' })

  const allSchedules = useMemo(() => {
    const todoSchedules = todos
      .filter((t) => t.startDate || t.dueDate)
      .map((t) => todoToScheduleItem(t))
    return [...schedules, ...todoSchedules]
  }, [schedules, todos])

  function handleViewTypeChange(type: CalendarViewType): void {
    calendar.setViewType(type)
    if (tabId) {
      navigateTab(tabId, {
        searchParams: { ...tabSearchParams, viewType: type }
      })
    }
  }

  function syncCurrentDate(date: Date): void {
    if (tabId) {
      navigateTab(tabId, {
        searchParams: { ...tabSearchParams, currentDate: date.toISOString() }
      })
    }
  }

  function handlePrev(): void {
    const newDate =
      calendar.viewType === 'month'
        ? subMonths(calendar.currentDate, 1)
        : calendar.viewType === 'week'
          ? subWeeks(calendar.currentDate, 1)
          : subDays(calendar.currentDate, 1)
    calendar.goPrev()
    syncCurrentDate(newDate)
  }

  function handleNext(): void {
    const newDate =
      calendar.viewType === 'month'
        ? addMonths(calendar.currentDate, 1)
        : calendar.viewType === 'week'
          ? addWeeks(calendar.currentDate, 1)
          : addDays(calendar.currentDate, 1)
    calendar.goNext()
    syncCurrentDate(newDate)
  }

  function handleToday(): void {
    calendar.goToday()
    syncCurrentDate(new Date())
  }

  function handleSelectDate(date: Date): void {
    calendar.selectDate(date)
    syncCurrentDate(date)
  }

  return (
    <TabContainer
      scrollable={false}
      header={
        <TabHeader
          title="캘린더"
          description="일정을 관리하는 캘린더 페이지입니다."
          buttons={
            workspaceId ? (
              <div className="flex items-center gap-2">
                <CalendarViewToolbar
                  viewType={calendar.viewType}
                  onViewTypeChange={handleViewTypeChange}
                />
                <ScheduleFormDialog
                  workspaceId={workspaceId}
                  trigger={<Button size="sm">+ 추가</Button>}
                />
              </div>
            ) : (
              <></>
            )
          }
        />
      }
    >
      {!workspaceId ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          워크스페이스를 선택해주세요
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden pt-3 gap-2">
          <div className="flex items-center justify-between px-1">
            <CalendarNavigation
              title={calendar.title}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
            />
          </div>
          {calendar.viewType === 'month' && (
            <MonthView
              schedules={allSchedules}
              currentDate={calendar.currentDate}
              selectedDate={calendar.selectedDate}
              onSelectDate={handleSelectDate}
              workspaceId={workspaceId}
            />
          )}
          {calendar.viewType === 'week' && (
            <WeekView
              schedules={allSchedules}
              currentDate={calendar.currentDate}
              selectedDate={calendar.selectedDate}
              onSelectDate={handleSelectDate}
              workspaceId={workspaceId}
            />
          )}
          {calendar.viewType === 'day' && (
            <DayView
              schedules={allSchedules}
              currentDate={calendar.currentDate}
              workspaceId={workspaceId}
            />
          )}
        </div>
      )}
    </TabContainer>
  )
}
