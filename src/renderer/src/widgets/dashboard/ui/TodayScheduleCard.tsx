import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { useSchedulesByWorkspace } from '@entities/schedule'
import type { ScheduleItem } from '@entities/schedule'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { Badge } from '@shared/ui/badge'
import { DashboardCard } from '@shared/ui/dashboard-card'
import { Separator } from '@shared/ui/separator'

interface TodayScheduleCardProps {
  workspaceId: string
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatRelativeDate(date: Date): string {
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === 2) return '모레'
  return `${diff}일 후`
}

export function TodayScheduleCard({ workspaceId }: TodayScheduleCardProps): React.JSX.Element {
  const todayRange = useMemo(
    () => ({
      start: startOfDay(new Date()),
      end: endOfDay(addDays(new Date(), 7))
    }),
    []
  )

  const { data: schedules = [], isLoading } = useSchedulesByWorkspace(workspaceId, todayRange)
  const openTab = useTabStore((s) => s.openTab)

  const { todaySchedules, upcomingSchedules } = useMemo(() => {
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    const today = schedules
      .filter((s: ScheduleItem) => s.startAt <= todayEnd && s.endAt >= todayStart)
      .sort((a: ScheduleItem, b: ScheduleItem) => {
        if (a.allDay && !b.allDay) return -1
        if (!a.allDay && b.allDay) return 1
        return a.startAt.getTime() - b.startAt.getTime()
      })

    const upcoming = schedules
      .filter((s: ScheduleItem) => s.startAt > todayEnd)
      .sort((a: ScheduleItem, b: ScheduleItem) => a.startAt.getTime() - b.startAt.getTime())
      .slice(0, 5)

    return { todaySchedules: today, upcomingSchedules: upcoming }
  }, [schedules])

  const handleClick = (schedule: ScheduleItem): void => {
    openTab({
      type: 'calendar',
      pathname: ROUTES.CALENDAR,
      title: '캘린더',
      searchParams: { scheduleId: schedule.id }
    })
  }

  return (
    <DashboardCard title="오늘 일정" icon={Calendar} isLoading={isLoading}>
      {todaySchedules.length === 0 && upcomingSchedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">오늘 일정이 없습니다</p>
      ) : (
        <div className="space-y-3">
          {todaySchedules.length > 0 && (
            <div className="space-y-0.5">
              {todaySchedules.map((schedule) => (
                <button
                  key={schedule.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => handleClick(schedule)}
                >
                  <div
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: schedule.color || 'var(--muted-foreground)' }}
                  />
                  {schedule.allDay ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      종일
                    </Badge>
                  ) : (
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {formatTime(schedule.startAt)}
                    </span>
                  )}
                  <span className="truncate">{schedule.title}</span>
                </button>
              ))}
            </div>
          )}

          {upcomingSchedules.length > 0 && (
            <>
              {todaySchedules.length > 0 && <Separator />}
              <div className="space-y-0.5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">다가오는 일정</p>
                {upcomingSchedules.map((schedule) => (
                  <button
                    key={schedule.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                    onClick={() => handleClick(schedule)}
                  >
                    <div
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: schedule.color || 'var(--muted-foreground)' }}
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(schedule.startAt)}
                    </span>
                    <span className="truncate">{schedule.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
