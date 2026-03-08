import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Bell,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Link,
  Pencil,
  Trash2,
  Check,
  Circle
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import type { ScheduleItem } from '@entities/schedule'
import { useLinkedEntities } from '@entities/entity-link'
import { ENTITY_TYPE_ICON } from '@shared/lib/entity-link'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { TabType } from '@shared/constants/tab-url'
import { getScheduleColor } from '../model/schedule-color'
import { isTodoItem } from '../model/calendar-utils'
import { useReminders, REMINDER_OFFSETS } from '@entities/reminder'
import { ScheduleFormDialog } from './ScheduleFormDialog'
import { DeleteScheduleDialog } from './DeleteScheduleDialog'
import { LinkEntityPopover, OpenAllSubmenu } from '@features/entity-link/manage-link'

interface Props {
  schedule: ScheduleItem
  workspaceId: string
  children: React.ReactNode
}

export function ScheduleDetailPopover({
  schedule,
  workspaceId,
  children
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const color = getScheduleColor(schedule)
  const isTodo = isTodoItem(schedule)
  const { data: linked = [] } = useLinkedEntities('schedule', schedule.id)
  const { data: reminders = [] } = useReminders('schedule', schedule.id)
  const openTab = useTabStore((s) => s.openTab)

  const handleNavigateLinked = useCallback(
    (linkedType: LinkableEntityType, linkedId: string, title: string) => {
      const map: Record<LinkableEntityType, { type: TabType; pathname: string } | null> = {
        todo: { type: 'todo-detail', pathname: `/todo/${linkedId}` },
        note: { type: 'note', pathname: `/folder/note/${linkedId}` },
        pdf: { type: 'pdf', pathname: `/folder/pdf/${linkedId}` },
        csv: { type: 'csv', pathname: `/folder/csv/${linkedId}` },
        image: { type: 'image', pathname: `/folder/image/${linkedId}` },
        schedule: null
      }
      const opts = map[linkedType]
      if (opts) openTab({ ...opts, title })
    },
    [openTab]
  )

  function formatDateRange(): string {
    if (schedule.allDay) {
      const start = format(schedule.startAt, 'yyyy.MM.dd (eee)', { locale: ko })
      const end = format(schedule.endAt, 'yyyy.MM.dd (eee)', { locale: ko })
      return start === end ? start : `${start} ~ ${end}`
    }
    const start = format(schedule.startAt, 'yyyy.MM.dd (eee)', { locale: ko })
    const end = format(schedule.endAt, 'yyyy.MM.dd (eee)', { locale: ko })
    const startTime = format(schedule.startAt, 'HH:mm')
    const endTime = format(schedule.endAt, 'HH:mm')
    if (start === end) {
      return `${start} ${startTime} ~ ${endTime}`
    }
    return `${start} ${startTime} ~ ${end} ${endTime}`
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              {isTodo ? (
                schedule.isDone ? (
                  <Check className="size-3.5 mt-0.5 shrink-0" strokeWidth={3} style={{ color }} />
                ) : (
                  <Circle className="size-3 mt-1 shrink-0" strokeWidth={3} style={{ color }} />
                )
              ) : (
                <div
                  className="size-3 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
              <div className="flex-1 min-w-0">
                <span
                  className={`font-semibold text-sm leading-snug ${schedule.isDone ? 'line-through opacity-60' : ''}`}
                >
                  {schedule.title}
                </span>
                {isTodo && (
                  <span className="inline-flex items-center gap-0.5 ml-1.5 text-[10px] text-muted-foreground bg-muted rounded px-1 py-px align-middle">
                    <Check className="size-2.5" />할 일
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                <span>{formatDateRange()}</span>
              </div>
              {!schedule.allDay && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>
                    {format(schedule.startAt, 'HH:mm')} ~ {format(schedule.endAt, 'HH:mm')}
                  </span>
                </div>
              )}
              {schedule.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  <span>{schedule.location}</span>
                </div>
              )}
              {schedule.description && (
                <div className="flex items-start gap-1.5">
                  <FileText className="size-3.5 mt-0.5" />
                  <span className="line-clamp-3">{schedule.description}</span>
                </div>
              )}
              {!isTodo && reminders.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Bell className="size-3.5" />
                  <span>
                    {reminders
                      .map((r) => {
                        const found = REMINDER_OFFSETS.find((o) => o.value === r.offsetMs)
                        return found?.label ?? `${Math.round(r.offsetMs / 60000)}분 전`
                      })
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>

            {linked.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground border-t pt-1.5">
                <div className="flex items-center gap-1">
                  <Link className="size-3" />
                  <span className="font-medium">연결된 항목</span>
                </div>
                {linked.map((item) => {
                  const ItemIcon = ENTITY_TYPE_ICON[item.entityType]
                  return (
                    <button
                      key={`${item.entityType}-${item.entityId}`}
                      type="button"
                      className="flex items-center gap-1.5 w-full pl-4 truncate text-left hover:underline cursor-pointer"
                      onClick={() =>
                        handleNavigateLinked(item.entityType, item.entityId, item.title)
                      }
                    >
                      <ItemIcon className="size-3 shrink-0" />
                      <span>{item.title}</span>
                    </button>
                  )
                })}
                {linked.length > 1 && (
                  <OpenAllSubmenu linked={linked} onDone={() => setOpen(false)} />
                )}
              </div>
            )}

            {!isTodo && (
              <div className="flex justify-end gap-1 pt-1 border-t">
                <LinkEntityPopover
                  entityType="schedule"
                  entityId={schedule.id}
                  workspaceId={workspaceId}
                >
                  <Button variant="ghost" size="icon-xs">
                    <Link className="size-3.5" />
                  </Button>
                </LinkEntityPopover>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setOpen(false)
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setOpen(false)
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {!isTodo && (
        <>
          <ScheduleFormDialog
            workspaceId={workspaceId}
            initialData={schedule}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          <DeleteScheduleDialog
            scheduleId={schedule.id}
            workspaceId={workspaceId}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}
    </>
  )
}
