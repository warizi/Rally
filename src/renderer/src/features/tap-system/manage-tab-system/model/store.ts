import { create } from 'zustand'
import { TabStoreState } from './types'
import { devtools } from 'zustand/middleware'
import { createInitialState } from '../lib/factory'
import { createTabActions } from './tab.action'
import { createPaneActions } from './pane.action'
import { createLayoutActions } from './layout.action'
import {
  selectActiveTab,
  selectPane,
  selectPaneByTabId,
  selectTab,
  selectTabByPathname
} from './selectors'

export const useTabStore = create<TabStoreState>()(
  devtools((set, get) => ({
    ...createInitialState(),
    ...createTabActions(set, get),
    ...createPaneActions(set, get),
    ...createLayoutActions(set, get),

    reset: () => set(createInitialState()),

    getTabById: (tabId: string) => selectTab(tabId)(get()),
    getPaneById: (paneId: string) => selectPane(paneId)(get()),
    getActiveTab: (paneId: string) => selectActiveTab(paneId)(get()),
    findPaneByTabId: (tabId: string) => selectPaneByTabId(tabId)(get()),
    findTabByPathname: (pathname: string) => selectTabByPathname(pathname)(get())
  }))
)
