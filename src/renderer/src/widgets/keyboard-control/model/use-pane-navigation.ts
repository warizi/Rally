/**
 * Pane 이동 hook — `ctrl + shift` (유지) + 방향키.
 *
 * 오버레이 없이 즉시 active pane 전환. modifier 유지된 상태에서 방향키
 * 클릭마다 인접 pane 으로 이동. modifier 해제 시 모드 종료.
 *
 * NoteEditor 등 입력 가능 영역에 포커스가 있으면 비활성 (useGlobalHotkey
 * 가 처리).
 */
import { useTabStore } from '@/entities/tab-system'
import { findAdjacentPaneId, type ArrowDirection } from '@/entities/tab-system/model/layout'
import { useKeyboardModeStore } from './keyboard-mode-store'
import { useGlobalHotkey } from './use-global-hotkey'

function arrowKeyToDirection(key: string): ArrowDirection | null {
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  return null
}

export function usePaneNavigation(): void {
  const setMode = useKeyboardModeStore((s) => s.setMode)
  const clearMode = useKeyboardModeStore((s) => s.clearMode)

  useGlobalHotkey({
    modifiers: { ctrl: true, shift: true },
    onActivate: () => setMode('pane-nav'),
    onDeactivate: () => clearMode('pane-nav'),
    onKeyDown: (e) => {
      const dir = arrowKeyToDirection(e.key)
      if (!dir) return
      e.preventDefault()
      const { layout, activePaneId, setActivePane } = useTabStore.getState()
      const target = findAdjacentPaneId(layout, activePaneId, dir)
      if (target && target !== activePaneId) setActivePane(target)
    }
  })
}
