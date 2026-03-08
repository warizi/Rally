import { LayoutNode, Pane, PaneNode, SplitNode, Tab } from '@/entities/tab-system'
import { TabType } from '@/shared/constants/tab-url'

import type { StoreApi } from 'zustand'

export type SetState = StoreApi<TabStoreState>['setState']
export type GetState = StoreApi<TabStoreState>['getState']

export type SplitPosition = 'top' | 'right' | 'bottom' | 'left'

export interface TabOptions {
  type: TabType
  pathname: string
  title: string
  searchParams?: Record<string, string>
  icon?: string
  pinned?: boolean
  updateSearchParams?: boolean
}

export interface NavigateOptions {
  pathname?: string
  searchParams?: Record<string, string>
}

export interface TabState {
  tabs: Record<string, Tab>
  panes: Record<string, Pane>
  layout: LayoutNode
  activePaneId: string
}

export interface TabActions {
  // Tab 액션
  openTab: (options: TabOptions, targetPaneId?: string) => string
  openRightTab: (options: TabOptions, sourcePaneId: string) => string
  closeTab: (tabId: string) => void
  closeAllTabs: (paneId: string) => void
  closeOtherTabs: (paneId: string, keepTabId: string) => void
  closeTabByPathname: (pathname: string) => void
  activateTab: (tabId: string, paneId?: string) => void
  pinTab: (tabId: string) => void
  unpinTab: (tabId: string) => void
  navigateTab: (tabId: string, options: NavigateOptions) => void
  setTabTitle: (tabId: string, title: string) => void
  setTabError: (tabId: string, error: boolean) => void

  // Pane 액션
  setActivePane: (paneId: string) => void
  splitPane: (paneId: string, position: SplitPosition, tabId?: string) => string
  closePane: (paneId: string) => void
  moveTabToPane: (tabId: string, sourcePaneId: string, targetPaneId: string) => void
  updateLayoutSizes: (nodeId: string, sizes: number[]) => void

  // 편의 셀렉터 (store에서 직접 사용 가능한 래퍼)
  getTabById: (tabId: string) => Tab | undefined
  getPaneById: (paneId: string) => Pane | undefined
  getActiveTab: (paneId?: string) => Tab | undefined
  findPaneByTabId: (tabId: string) => Pane | undefined
  findTabByPathname: (pathname: string) => Tab | undefined

  // 상태 초기화
  reset: () => void
}

export type TabStoreState = TabState & TabActions

// 타입 가드
export function isPaneNode(node: LayoutNode): node is PaneNode {
  return node.type === 'pane'
}

export function isSplitContainerNode(node: LayoutNode): node is SplitNode {
  return node.type === 'split'
}
