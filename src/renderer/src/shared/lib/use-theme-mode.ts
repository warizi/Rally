/**
 * `<html>` 의 `dark` class 를 구독해 현재 테마 mode 반환.
 *
 * - 프로젝트는 next-themes 의 Provider 를 마운트하지 않고 `applyTheme()` 으로
 *   직접 `classList` 를 토글하기 때문에, `useTheme()` 대신 MutationObserver 로 감지.
 */
import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

function currentMode(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(currentMode)

  useEffect(() => {
    const observer = new MutationObserver(() => setMode(currentMode()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return mode
}
