import { useQuery, useQueryClient } from '@tanstack/react-query'

const SETTINGS_KEY = 'tabHeaderDefaultCollapsed'
const DB_KEY = 'tabHeader.defaultCollapsed'

export function useTabHeaderCollapsedSetting(): {
  collapsed: boolean
  setCollapsed: (value: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()

  const { data: collapsed = false } = useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async (): Promise<boolean> => {
      const res = await window.api.settings.get(DB_KEY)
      return res.success && res.data === 'true'
    }
  })

  async function setCollapsed(value: boolean): Promise<void> {
    await window.api.settings.set(DB_KEY, String(value))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  return { collapsed, setCollapsed }
}
