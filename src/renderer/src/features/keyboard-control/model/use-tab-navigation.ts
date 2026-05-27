/**
 * 탭 이동 hook — `shift` (유지) + `tab` (클릭).
 *
 * Lifecycle:
 * - 첫 Tab keydown: active pane 의 tab 목록 캡처 → tab-nav-store.start
 *   (focusIndex = 현재 active 다음). 모드 = 'tab-nav'
 * - 이후 Tab keydown: next() — focusIndex 순환
 * - shift 해제: focusIndex 탭으로 activateTab → close() + mode clear
 *
 * 활성 pane 변경은 모드 진입 시점에만 캡처 — 진입 후 store 가 바뀌어도
 * 오버레이가 흔들리지 않는다.
 */
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { useGlobalHotkey } from './use-global-hotkey'
import { useKeyboardModeStore } from './keyboard-mode-store'
import { useTabNavStore, type TabNavItem } from './tab-nav-store'

function captureItemsForActivePane(): {
  items: TabNavItem[]
  initialFocus: number
} {
  const { activePaneId, panes, tabs } = useTabStore.getState()
  const pane = panes[activePaneId]
  if (!pane) return { items: [], initialFocus: 0 }
  const items: TabNavItem[] = pane.tabIds
    .map((id) => tabs[id])
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({ tabId: t.id, title: t.title, type: t.type as string }))
  const activeIdx = items.findIndex((it) => it.tabId === pane.activeTabId)
  // 시작은 다음 탭에 focus — Vim 의 :tabnext 와 동일 발상.
  const initialFocus =
    items.length === 0 ? 0 : (Math.max(activeIdx, 0) + 1) % items.length
  return { items, initialFocus }
}

export function useTabNavigation(): void {
  const setMode = useKeyboardModeStore((s) => s.setMode)
  const clearMode = useKeyboardModeStore((s) => s.clearMode)

  useGlobalHotkey({
    modifiers: { shift: true },
    onKeyDown: (e) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const { open } = useTabNavStore.getState()
      if (!open) {
        const { items, initialFocus } = captureItemsForActivePane()
        if (items.length === 0) return
        useTabNavStore.getState().start(items, initialFocus)
        setMode('tab-nav')
      } else {
        useTabNavStore.getState().next()
      }
    },
    onDeactivate: () => {
      const { open, items, focusIndex } = useTabNavStore.getState()
      if (open) {
        const target = items[focusIndex]
        if (target) useTabStore.getState().activateTab(target.tabId)
      }
      useTabNavStore.getState().close()
      clearMode('tab-nav')
    }
  })
}
