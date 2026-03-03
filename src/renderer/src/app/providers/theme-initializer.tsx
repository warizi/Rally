import { useEffect } from 'react'
import { applyTheme, type Theme } from '@shared/lib/theme'

export function ThemeInitializer(): null {
  useEffect(() => {
    window.api.settings.get('theme').then((res) => {
      if (res.success && res.data) {
        applyTheme(res.data as Theme)
      }
    })
  }, [])

  return null
}
