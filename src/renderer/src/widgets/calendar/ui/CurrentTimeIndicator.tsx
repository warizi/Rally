import { useEffect, useState } from 'react'
import { DEFAULT_START_HOUR, timeToPosition } from '../model/calendar-utils'

interface Props {
  hourHeight: number
  startHour?: number
}

export function CurrentTimeIndicator({
  hourHeight,
  startHour = DEFAULT_START_HOUR
}: Props): React.JSX.Element {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const top = timeToPosition(now, hourHeight, startHour)

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="size-2 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-px bg-red-500" />
      </div>
    </div>
  )
}
