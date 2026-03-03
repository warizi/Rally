import { createTab, createTabId } from '../lib/factory'
import {
  findPaneNodeInLayout,
  findRightPaneInHorizontalSplit,
  removePaneFromLayout
} from './layout'
import { selectPaneByTabId, selectTabByPathname } from './selectors'
import { GetState, NavigateOptions, SetState, TabOptions } from './types'

export const createTabActions = (
  set: SetState,
  get: GetState
): ReturnType<typeof createTabActions> => ({
  openTab: (options: TabOptions, targetPaneId?: string): string => {
    const { tabs, panes, activePaneId } = get()
    const tabId = createTabId(options.pathname)

    // 이미 같은 pathname을 가진 탭이 열려있는지 확인
    if (tabs[tabId]) {
      const existingPane = selectPaneByTabId(tabId)(get())
      if (existingPane) {
        set((state) => ({
          tabs: {
            ...state.tabs,
            [tabId]: {
              ...state.tabs[tabId],
              lastAccessedAt: Date.now(),
              searchParams: options.updateSearchParams
                ? options.searchParams
                : state.tabs[tabId].searchParams
            }
          },
          panes: {
            ...state.panes,
            [existingPane.id]: {
              ...existingPane,
              activeTabId: tabId
            }
          },
          activePaneId: existingPane.id
        }))
        return tabId
      }
    }

    // 새로운 탭 생성
    const paneId = targetPaneId ?? activePaneId
    const pane = panes[paneId]
    if (!pane) return ''

    const newTab = createTab(options)

    set((state) => ({
      tabs: {
        ...state.tabs,
        [newTab.id]: newTab
      },
      panes: {
        ...state.panes,
        [paneId]: {
          ...pane,
          tabIds: [...pane.tabIds, newTab.id],
          activeTabId: newTab.id
        }
      },
      activePaneId: paneId
    }))

    return newTab.id
  },

  openRightTab: (options: TabOptions, sourcePaneId: string): string => {
    const { tabs, panes, layout } = get()
    const tabId = createTabId(options.pathname)

    // 이미 존재하는 탭이면 활성화만
    if (tabs[tabId]) {
      const existingPane = selectPaneByTabId(tabId)(get())
      if (existingPane) {
        set((s) => ({
          tabs: { ...s.tabs, [tabId]: { ...s.tabs[tabId], lastAccessedAt: Date.now() } },
          panes: { ...s.panes, [existingPane.id]: { ...existingPane, activeTabId: tabId } },
          activePaneId: existingPane.id
        }))
        return tabId
      }
    }

    const paneNode = findPaneNodeInLayout(layout, sourcePaneId)
    if (!paneNode) return get().openTab(options)

    const rightPaneId = findRightPaneInHorizontalSplit(layout, paneNode.id)
    if (rightPaneId && panes[rightPaneId]) {
      return get().openTab(options, rightPaneId)
    }

    const newPaneId = get().splitPane(sourcePaneId, 'right')
    return get().openTab(options, newPaneId)
  },

  closeTab: (tabId: string): void => {
    const { tabs, panes, layout, activePaneId } = get()

    const pane = selectPaneByTabId(tabId)(get())
    if (!pane) return

    const newTabIds = pane.tabIds.filter((id) => id !== tabId)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [tabId]: _removed, ...remainingTabs } = tabs

    // 마지막 탭이고 다른 패인이 있으면 패인도 닫기
    if (newTabIds.length === 0 && Object.keys(panes).length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [pane.id]: _removedPane, ...remainingPanes } = panes
      const newLayout = removePaneFromLayout(layout, pane.id)
      const newActivePaneId =
        activePaneId === pane.id ? Object.keys(remainingPanes)[0] : activePaneId

      set({
        tabs: remainingTabs,
        panes: remainingPanes,
        layout: newLayout,
        activePaneId: newActivePaneId
      })
      return
    }

    // 일반 탭 닫기
    let newActiveTabId = pane.activeTabId
    if (pane.activeTabId === tabId) {
      const closedIndex = pane.tabIds.indexOf(tabId)
      newActiveTabId = newTabIds[Math.min(closedIndex, newTabIds.length - 1)] ?? null
    }

    set({
      tabs: remainingTabs,
      panes: { ...panes, [pane.id]: { ...pane, tabIds: newTabIds, activeTabId: newActiveTabId } }
    })
  },

  closeAllTabs: (paneId: string): void => {
    const { tabs, panes, layout, activePaneId } = get()
    const pane = panes[paneId]
    if (!pane) return

    // 핀 고정 탭 유지, 나머지 닫기
    const pinnedTabIds = pane.tabIds.filter((id) => tabs[id]?.pinned)
    const closedTabIds = pane.tabIds.filter((id) => !tabs[id]?.pinned)
    if (closedTabIds.length === 0) return

    const remainingTabs = { ...tabs }
    for (const id of closedTabIds) {
      delete remainingTabs[id]
    }

    // 핀 탭이 없고 다른 패인이 있으면 패인 닫기
    if (pinnedTabIds.length === 0 && Object.keys(panes).length > 1) {
      const { [paneId]: _removedPane, ...remainingPanes } = panes
      const newLayout = removePaneFromLayout(layout, paneId)
      const newActivePaneId =
        activePaneId === paneId ? Object.keys(remainingPanes)[0] : activePaneId

      set({
        tabs: remainingTabs,
        panes: remainingPanes,
        layout: newLayout,
        activePaneId: newActivePaneId
      })
      return
    }

    set({
      tabs: remainingTabs,
      panes: {
        ...panes,
        [paneId]: {
          ...pane,
          tabIds: pinnedTabIds,
          activeTabId: pinnedTabIds[0] ?? null
        }
      }
    })
  },

  closeOtherTabs: (paneId: string, keepTabId: string): void => {
    const { tabs, panes } = get()
    const pane = panes[paneId]
    if (!pane) return

    const keepTabIds = pane.tabIds.filter((id) => id === keepTabId || tabs[id]?.pinned)
    const closedTabIds = pane.tabIds.filter((id) => id !== keepTabId && !tabs[id]?.pinned)
    if (closedTabIds.length === 0) return

    const remainingTabs = { ...tabs }
    for (const id of closedTabIds) {
      delete remainingTabs[id]
    }

    set({
      tabs: remainingTabs,
      panes: {
        ...panes,
        [paneId]: {
          ...pane,
          tabIds: keepTabIds,
          activeTabId: keepTabId
        }
      }
    })
  },

  closeTabByPathname: (pathname: string): void => {
    const tab = selectTabByPathname(pathname)(get())
    if (!tab) return
    get().closeTab(tab.id)
  },

  activateTab: (tabId: string, paneId?: string): void => {
    const { tabs, panes } = get()
    const tab = tabs[tabId]
    if (!tab) return

    const targetPaneId = paneId ?? selectPaneByTabId(tabId)(get())?.id
    if (!targetPaneId) return

    const pane = panes[targetPaneId]
    if (!pane) return

    const tabIds = pane.tabIds.includes(tabId) ? pane.tabIds : [...pane.tabIds, tabId]

    set({
      tabs: { ...tabs, [tabId]: { ...tab, lastAccessedAt: Date.now() } },
      panes: { ...panes, [targetPaneId]: { ...pane, tabIds, activeTabId: tabId } },
      activePaneId: targetPaneId
    })
  },
  navigateTab: (tabId: string, options: NavigateOptions): void => {
    const { tabs, panes } = get()
    const tab = tabs[tabId]
    if (!tab) return

    // pathname 변경
    if (options.pathname && options.pathname !== tab.pathname) {
      const newTabId = createTabId(options.pathname)

      // 이미 해당 pathname 탭 존재 → 포커스
      const existingTab = selectTabByPathname(options.pathname)(get())
      if (existingTab) {
        const existingPane = selectPaneByTabId(existingTab.id)(get())
        if (existingPane) get().activateTab(existingTab.id, existingPane.id)
        return
      }

      const pane = selectPaneByTabId(tabId)(get())
      if (!pane) return

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tabId]: _old, ...remainingTabs } = tabs
      const updatedTab = {
        ...tab,
        id: newTabId,
        pathname: options.pathname,
        searchParams: options.searchParams,
        lastAccessedAt: Date.now()
      }

      set({
        tabs: { ...remainingTabs, [newTabId]: updatedTab },
        panes: {
          ...panes,
          [pane.id]: {
            ...pane,
            tabIds: pane.tabIds.map((id) => (id === tabId ? newTabId : id)),
            activeTabId: pane.activeTabId === tabId ? newTabId : pane.activeTabId
          }
        }
      })
      return
    }

    // search만 변경
    if (options.searchParams !== undefined) {
      set({
        tabs: {
          ...tabs,
          [tabId]: { ...tab, searchParams: options.searchParams, lastAccessedAt: Date.now() }
        }
      })
    }
  },

  pinTab: (tabId: string): void => {
    const { tabs } = get()
    const tab = tabs[tabId]
    if (!tab) return
    set({ tabs: { ...tabs, [tabId]: { ...tab, pinned: true } } })
  },

  unpinTab: (tabId: string): void => {
    const { tabs } = get()
    const tab = tabs[tabId]
    if (!tab) return
    set({ tabs: { ...tabs, [tabId]: { ...tab, pinned: false } } })
  },

  setTabTitle: (tabId: string, title: string): void => {
    const { tabs } = get()
    const tab = tabs[tabId]
    if (!tab) return
    set({ tabs: { ...tabs, [tabId]: { ...tab, title } } })
  },

  setTabError: (tabId: string, error: boolean): void => {
    const { tabs } = get()
    const tab = tabs[tabId]
    if (!tab) return
    set({ tabs: { ...tabs, [tabId]: { ...tab, error } } })
  }
})
