import { useQuery, useQueryClient } from '@tanstack/react-query'

const SETTINGS_KEY = 'todoDefaultDateToday'
const DB_KEY = 'todo.create.default.date.today'

export function useTodoDefaultDateSetting(): {
  enabled: boolean
  setEnabled: (value: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()

  const { data: enabled = false } = useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async (): Promise<boolean> => {
      const res = await window.api.settings.get(DB_KEY)
      return res.success && res.data === 'true'
    }
  })

  async function setEnabled(value: boolean): Promise<void> {
    await window.api.settings.set(DB_KEY, String(value))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  return { enabled, setEnabled }
}
