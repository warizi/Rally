import { useEffect } from 'react'
import { useTabStore } from './store'

// focus 모드 스택의 부수 효과 관리.
// - ESC 키로 top pop (스택에 남은 게 있으면 그것이 표시, 비면 일반 모드)
// - 사라진 탭(닫기/리셋 등)은 스택에서 자동 정리
export function useFocusModeEffects(): void {
  const focusedDepth = useTabStore((state) => state.focusedTabIds.length)
  const hasInvalidEntry = useTabStore((state) =>
    state.focusedTabIds.some((id) => !state.tabs[id])
  )

  // 사라진 탭 정리
  useEffect(() => {
    if (!hasInvalidEntry) return
    useTabStore.setState((state) => ({
      focusedTabIds: state.focusedTabIds.filter((id) => state.tabs[id])
    }))
  }, [hasInvalidEntry])

  // ESC 키 핸들러 — 스택 top 한 칸 pop
  useEffect(() => {
    if (focusedDepth === 0) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        useTabStore.getState().exitFocusMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedDepth])
}
