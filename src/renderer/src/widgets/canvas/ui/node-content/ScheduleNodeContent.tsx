import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Clock, MapPin } from 'lucide-react'
import type { NodeContentProps } from '../../model/node-content-registry'

export function ScheduleNodeContent({ refTitle, refMeta }: NodeContentProps): React.JSX.Element {
  const meta = refMeta ?? {}
  const allDay = meta.allDay as boolean | undefined
  const startAt = meta.startAt as string | number | Date | null | undefined
  const endAt = meta.endAt as string | number | Date | null | undefined
  const location = meta.location as string | null | undefined
  const description = meta.description as string | null | undefined
  const color = meta.color as string | null | undefined

  function formatDateRange(): string {
    if (!startAt || !endAt) return ''
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (allDay) {
      const s = format(start, 'MM.dd (eee)', { locale: ko })
      const e = format(end, 'MM.dd (eee)', { locale: ko })
      return s === e ? s : `${s} ~ ${e}`
    }
    const sDate = format(start, 'MM.dd (eee)', { locale: ko })
    const eDate = format(end, 'MM.dd (eee)', { locale: ko })
    const sTime = format(start, 'HH:mm')
    const eTime = format(end, 'HH:mm')
    if (sDate === eDate) return `${sDate} ${sTime} ~ ${eTime}`
    return `${sDate} ${sTime} ~ ${eDate} ${eTime}`
  }

  return (
    <div className="p-3 flex-1 overflow-y-auto nowheel flex flex-col gap-2">
      <div className="flex items-start gap-2">
        {color && (
          <div className="size-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: color }} />
        )}
        <p className="text-sm font-medium truncate">{refTitle || '(제목 없음)'}</p>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {(startAt || endAt) && (
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 shrink-0" />
            <span>{formatDateRange()}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {description}
        </p>
      )}
    </div>
  )
}
