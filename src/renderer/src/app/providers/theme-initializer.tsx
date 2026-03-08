import { useEffect } from 'react'
import { applyTheme, applyFontSize, type Theme, type FontSize } from '@shared/lib/theme'

export function ThemeInitializer(): null {
  useEffect(() => {
    window.api.settings.get('theme').then((res) => {
      if (res.success && res.data) {
        applyTheme(res.data as Theme)
      }
    })
    window.api.settings.get('fontSize').then((res) => {
      if (res.success && res.data) {
        applyFontSize(res.data as FontSize)
      }
    })
  }, [])

  return null
}
