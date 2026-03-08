import { createPane } from '../lib/factory'
import { insertPaneIntoLayout, removePaneFromLayout } from './layout'
import { GetState, SetState, SplitPosition } from './types'

export const createPaneActions = (
  set: SetState,
  get: GetState
): ReturnType<typeof createPaneActions> => ({
  setActivePane: (paneId: string): void => {
    if (!get().panes[paneId]) return
    set({ activePaneId: paneId })
  },

  splitPane: (paneId: string, position: SplitPosition, tabId?: string): string => {
    const { panes, layout } = get()
    const pane = panes[paneId]
    if (!pane) return paneId

    const newPane = createPane()
    let updatedPanes = { ...panes }

    // tabId가 주어진 경우, 해당 탭을 새로 생성된 pane으로 이동한다.
    if (tabId) {
      const sourcePane = Object.values(panes).find((p) => p.tabIds.includes(tabId))
      if (sourcePane) {
        const newSourceTabIds = sourcePane.tabIds.filter((id) => id !== tabId)
        updatedPanes[sourcePane.id] = {
          ...sourcePane,
          tabIds: newSourceTabIds,
          activeTabId:
            sourcePane.activeTabId === tabId ? (newSourceTabIds[0] ?? null) : sourcePane.activeTabId
        }
        newPane.tabIds = [tabId]
        newPane.activeTabId = tabId
      }
    }

    // 레이아웃에 새 패인 삽입
    let newLayout = insertPaneIntoLayout(layout, paneId, newPane.id, position)
    updatedPanes[newPane.id] = newPane

    // 소스 패인이 비었으면 제거
    const emptySourcePane = Object.values(updatedPanes).find(
      (p) => p.id !== newPane.id && p.tabIds.length === 0
    )
    if (emptySourcePane && Object.keys(updatedPanes).length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [emptySourcePane.id]: _removed, ...remainingPanes } = updatedPanes
      updatedPanes = remainingPanes
      newLayout = removePaneFromLayout(newLayout, emptySourcePane.id)
    }

    set({ panes: updatedPanes, layout: newLayout, activePaneId: newPane.id })
    return newPane.id
  },

  closePane: (paneId: string): void => {
    const { tabs, panes, layout, activePaneId } = get()
    const pane = panes[paneId]
    if (!pane || Object.keys(panes).length <= 1) return

    // 닫을 수 있는 탭만 제거
    const remainingTabs = { ...tabs }
    pane.tabIds.forEach((id) => {
      delete remainingTabs[id]
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [paneId]: _removedPane, ...remainingPanes } = panes
    const newLayout = removePaneFromLayout(layout, paneId)
    const newActivePaneId = activePaneId === paneId ? Object.keys(remainingPanes)[0] : activePaneId

    set({
      tabs: remainingTabs,
      panes: remainingPanes,
      layout: newLayout,
      activePaneId: newActivePaneId
    })
  },

  moveTabToPane: (tabId: string, sourcePaneId: string, targetPaneId: string): void => {
    const { tabs, panes, layout } = get()
    const tab = tabs[tabId]
    const sourcePane = panes[sourcePaneId]
    const targetPane = panes[targetPaneId]

    if (!tab || !sourcePane || !targetPane || sourcePaneId === targetPaneId) return

    const newSourceTabIds = sourcePane.tabIds.filter((id) => id !== tabId)
    const newTargetTabIds = targetPane.tabIds.includes(tabId)
      ? targetPane.tabIds
      : [...targetPane.tabIds, tabId]

    // 소스 패인이 비면 제거
    if (newSourceTabIds.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [sourcePaneId]: _removed, ...remainingPanes } = panes
      remainingPanes[targetPaneId] = { ...targetPane, tabIds: newTargetTabIds, activeTabId: tabId }
      const newLayout = removePaneFromLayout(layout, sourcePaneId)

      set({ panes: remainingPanes, layout: newLayout, activePaneId: targetPaneId })
      return
    }

    // 소스 패인에 탭이 남아있으면 일반 이동
    let newSourceActiveTabId = sourcePane.activeTabId
    if (sourcePane.activeTabId === tabId) {
      const closedIndex = sourcePane.tabIds.indexOf(tabId)
      newSourceActiveTabId =
        newSourceTabIds[Math.min(closedIndex, newSourceTabIds.length - 1)] ?? null
    }

    set({
      panes: {
        ...panes,
        [sourcePaneId]: {
          ...sourcePane,
          tabIds: newSourceTabIds,
          activeTabId: newSourceActiveTabId
        },
        [targetPaneId]: { ...targetPane, tabIds: newTargetTabIds, activeTabId: tabId }
      },
      activePaneId: targetPaneId
    })
  }
})
