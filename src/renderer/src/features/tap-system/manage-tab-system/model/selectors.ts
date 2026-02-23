import { Pane, Tab } from '@/entities/tab-system'
import type { TabStoreState } from './types'

// ─── 탭 셀렉터 ─────────────────────────────────────────
export const selectTab =
  (tabId: string) =>
    (s: TabStoreState): Tab | undefined =>
      s.tabs[tabId]

export const selectPaneByTabId =
  (tabId: string) =>
    (s: TabStoreState): Pane | undefined =>
      Object.values(s.panes).find((pane) => pane.tabIds.includes(tabId))

export const selectTabByPathname =
  (pathname: string) =>
    (s: TabStoreState): Tab | undefined =>
      Object.values(s.tabs).find((tab) => tab.pathname === pathname)

// ─── 패인 셀렉터 ───────────────────────────────────────
export const selectPane =
  (paneId: string) =>
    (s: TabStoreState): Pane | undefined =>
      s.panes[paneId]

export const selectActiveTab =
  (paneId?: string) =>
    (s: TabStoreState): Tab | undefined => {
      const targetPaneId = paneId ?? s.activePaneId
      const pane = s.panes[targetPaneId]
      if (!pane?.activeTabId) return undefined
      return s.tabs[pane.activeTabId]
    }

export const selectActivePane = (s: TabStoreState): Pane | undefined => s.panes[s.activePaneId]

export const selectPaneCount = (s: TabStoreState): number => Object.keys(s.panes).length
