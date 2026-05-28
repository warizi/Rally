// Core domain types
export type { Tab } from './model/tab.type'
export type { Pane } from './model/pane.type'
export type {
  LayoutNode,
  PaneNode,
  SplitNode,
  SplitDirection,
  LayoutNodeType
} from './model/layout.type'

// Store
export { useTabStore } from './model/store'
export type {
  TabState,
  TabActions,
  TabStoreState,
  TabOptions,
  NavigateOptions,
  SplitPosition,
  SetState,
  GetState
} from './model/types'
export { isPaneNode, isSplitContainerNode } from './model/types'

// Selectors
export {
  selectActiveTab,
  selectActivePane,
  selectPaneByTabId,
  selectTabByPathname,
  selectPaneCount,
  selectFocusedTabId
} from './model/selectors'

// Lib
export {
  createTabId,
  createTab,
  createPane,
  createPaneNode,
  createSplitContainerNode,
  createInitialState,
  parseSearch
} from './lib/factory'
export { buildTabOptions } from './lib/build-tab-options'
export { PANE_DEFAULTS, LAYOUT_DEFAULTS } from './lib/constants'

// API
export type { SerializedTab, SessionData } from './api/queries'
export { loadSession, saveSession } from './api/queries'
