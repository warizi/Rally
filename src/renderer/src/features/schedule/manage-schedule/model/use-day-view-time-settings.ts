import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_START_HOUR, DEFAULT_END_HOUR } from './calendar-constants'

export interface DayViewTimeSettings {
  startHour: number
  endHour: number
}

const SETTINGS_KEY = 'dayViewTime'

export function useDayViewTimeSettings(): {
  settings: DayViewTimeSettings
  updateStartHour: (hour: number) => Promise<void>
  updateEndHour: (hour: number) => Promise<void>
} {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async () => {
      const [startRes, endRes] = await Promise.all([
        window.api.settings.get('schedule.dayView.startHour'),
        window.api.settings.get('schedule.dayView.endHour')
      ])
      return {
        startHour:
          startRes.success && startRes.data ? parseInt(startRes.data, 10) : DEFAULT_START_HOUR,
        endHour: endRes.success && endRes.data ? parseInt(endRes.data, 10) : DEFAULT_END_HOUR
      }
    }
  })

  const settings: DayViewTimeSettings = data ?? {
    startHour: DEFAULT_START_HOUR,
    endHour: DEFAULT_END_HOUR
  }

  async function updateStartHour(hour: number): Promise<void> {
    await window.api.settings.set('schedule.dayView.startHour', String(hour))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  async function updateEndHour(hour: number): Promise<void> {
    await window.api.settings.set('schedule.dayView.endHour', String(hour))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  return { settings, updateStartHour, updateEndHour }
}
