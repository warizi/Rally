import { useRef, useEffect } from 'react'
import { ScrollArea } from '@shared/ui/scroll-area'
import { DEFAULT_START_HOUR, DEFAULT_END_HOUR, getTimeSlots } from '../model/calendar-utils'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'

interface Props {
  hourHeight: number
  labelWidth: string
  labelClass: string
  startHour?: number
  endHour?: number
  showCurrentTime?: boolean
  onTimeClick?: (hour: number, minute: number) => void
  children: React.ReactNode
}

export function TimeGrid({
  hourHeight,
  labelWidth,
  labelClass,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  showCurrentTime = true,
  onTimeClick,
  children
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const slots = getTimeSlots(startHour, endHour)
  const totalHeight = (endHour - startHour) * hourHeight

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      const scrollTo = Math.max((now.getHours() - startHour - 1) * hourHeight, 0)
      scrollRef.current.scrollTop = scrollTo
    }
  }, [hourHeight, startHour])

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (!onTimeClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
    const totalMinutes = (y / hourHeight) * 60
    const hour = startHour + Math.floor(totalMinutes / 60)
    const minute = Math.round((totalMinutes % 60) / 15) * 15
    onTimeClick(Math.min(hour, 23), minute >= 60 ? 0 : minute)
  }

  return (
    <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
      <div className="relative flex" style={{ height: totalHeight }}>
        {/* 시간 라벨 */}
        <div className="shrink-0" style={{ width: labelWidth }}>
          {slots.map((slot) => (
            <div
              key={slot.hour}
              className={`${labelClass} text-muted-foreground text-right pr-2`}
              style={{ height: hourHeight, lineHeight: `${hourHeight}px` }}
            >
              {slot.label}
            </div>
          ))}
        </div>

        {/* 그리드 본체 */}
        <div
          className="flex-1 relative border-l border-r border-b border-border"
          onClick={handleGridClick}
        >
          {/* 가로선 */}
          {slots.map((slot) => (
            <div
              key={slot.hour}
              className="absolute left-0 right-0 border-t border-border"
              style={{ top: (slot.hour - startHour) * hourHeight }}
            />
          ))}

          {/* 현재 시간 표시 */}
          {showCurrentTime && (
            <CurrentTimeIndicator hourHeight={hourHeight} startHour={startHour} />
          )}

          {/* 일정 블록 */}
          {children}
        </div>
      </div>
    </ScrollArea>
  )
}
