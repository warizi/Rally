import { useEffect } from 'react'
import { useGlobalSearchStore } from './store'

/**
 * Cmd/Ctrl+Shift+F 전역 단축키 → 전체 검색 다이얼로그 open.
 *
 * - capture 단계 window keydown 으로 등록 → 에디터/입력창 포커스 중에도 동작.
 *   (useGlobalHotkey 는 input 포커스 시 비활성이라 전역 검색엔 부적합)
 * - e.code === 'KeyF' 로 레이아웃/IME 무관하게 물리 F 키 감지.
 */
export function useGlobalSearchHotkey(): void {
  const setOpen = useGlobalSearchStore((s) => s.setOpen)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.code === 'KeyF') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [setOpen])
}
