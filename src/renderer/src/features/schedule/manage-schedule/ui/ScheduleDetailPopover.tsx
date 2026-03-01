import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Clock, MapPin, FileText, Pencil, Trash2 } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from '../model/schedule-color'
import { ScheduleFormDialog } from './ScheduleFormDialog'
import { DeleteScheduleDialog } from './DeleteScheduleDialog'

interface Props {
  schedule: ScheduleItem
  workspaceId: string
  children: React.ReactNode
}

export function ScheduleDetailPopover({
  schedule,
  workspaceId,
  children,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const color = getScheduleColor(schedule)

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
              <div
                className="size-3 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold text-sm leading-snug">{schedule.title}</span>
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
            </div>

            <div className="flex justify-end gap-1 pt-1 border-t">
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
          </div>
        </PopoverContent>
      </Popover>

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
  )
}
