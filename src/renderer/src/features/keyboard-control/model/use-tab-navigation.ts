/**
 * 탭 이동 hook — `cmd + opt` (유지) + `]` (다음) / `[` (이전).
 *
 * 키맵 근거:
 * - macOS 표준 `shift + tab` 은 reverse-focus 라 충돌 위험. 그래서
 *   `cmd + opt` modifier + bracket trigger 로 변경 (브라우저/VSCode 의
 *   `cmd+opt+] / [` 탭 nav 패턴과 일치).
 * - bracket 키는 `event.code` (BracketRight/BracketLeft) 로 비교 → IME /
 *   대소문자 / 한글 키보드 layout 영향 없음.
 *
 * Lifecycle:
 * - 첫 trigger keydown: active pane 의 tab 목록 캡처 → start. direction
 *   에 따라 한 step 적용한 focusIndex 로 시작 (Vim 의 :tabnext 발상).
 * - 이후 trigger keydown: next() / prev() 순환
 * - modifier 해제: focusIndex 탭으로 activateTab → close + mode clear
 */
import { useTabStore } from '@/features/tab-system/manage-tab-system'
import { useGlobalHotkey } from './use-global-hotkey'
import { useKeyboardModeStore } from './keyboard-mode-store'
import { useTabNavStore, type TabNavItem } from './tab-nav-store'

function captureItemsForActivePane(): {
  items: TabNavItem[]
  currentIdx: number
} {
  const { activePaneId, panes, tabs } = useTabStore.getState()
  const pane = panes[activePaneId]
  if (!pane) return { items: [], currentIdx: 0 }
  const items: TabNavItem[] = pane.tabIds
    .map((id) => tabs[id])
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({ tabId: t.id, title: t.title, type: t.type as string }))
  const currentIdx = items.findIndex((it) => it.tabId === pane.activeTabId)
  return { items, currentIdx: Math.max(currentIdx, 0) }
}

export function useTabNavigation(): void {
  const setMode = useKeyboardModeStore((s) => s.setMode)
  const clearMode = useKeyboardModeStore((s) => s.clearMode)

  useGlobalHotkey({
    modifiers: { meta: true, alt: true },
    onKeyDown: (e) => {
      let direction: 'next' | 'prev' | null = null
      if (e.code === 'BracketRight') direction = 'next'
      else if (e.code === 'BracketLeft') direction = 'prev'
      if (!direction) return
      e.preventDefault()

      const { open } = useTabNavStore.getState()
      if (!open) {
        const { items, currentIdx } = captureItemsForActivePane()
        if (items.length === 0) return
        const len = items.length
        const initialFocus =
          direction === 'next'
            ? (currentIdx + 1) % len
            : (currentIdx - 1 + len) % len
        useTabNavStore.getState().start(items, initialFocus)
        setMode('tab-nav')
      } else {
        if (direction === 'next') useTabNavStore.getState().next()
        else useTabNavStore.getState().prev()
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
