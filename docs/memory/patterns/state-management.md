# State Management (Zustand) Patterns

## store.ts Composition Pattern
```typescript
// model/store.ts
export const useTabStore = create<TabStoreState>()(
  devtools((set, get) => ({
    ...createInitialState(),           // initial state from factory
    ...createTabActions(set, get),
    ...createPaneActions(set, get),
    ...createLayoutActions(set, get),
    reset: () => set(createInitialState()),
    // selector wrappers for convenience
    getTabById: (id) => selectTab(id)(get()),
    findPaneByTabId: (id) => selectPaneByTabId(id)(get()),
  }))
)
```
- `devtools` middleware only (no combine, no persist in tab store)
- `persist` only in `shared/store/current-workspace.ts` (localStorage)

## Action Factory Pattern
```typescript
// model/tab.action.ts
export const createTabActions = (
  set: SetState,
  get: GetState
): ReturnType<typeof createTabActions> => ({
  openTab: (options: TabOptions, targetPaneId?: string): string => {
    const { tabs, panes, activePaneId } = get()
    // ...
    set((state) => ({ tabs: { ...state.tabs, ... } }))  // callback form
    // or: set({ panes: updatedPanes })                  // direct object form
    return newTab.id
  }
})
```
- Return type: `ReturnType<typeof createFn>` self-reference
- Files: `tab.action.ts`, `pane.action.ts`, `layout.action.ts`

## types.ts Pattern
```typescript
export type SetState = StoreApi<TabStoreState>['setState']
export type GetState = StoreApi<TabStoreState>['getState']

export interface TabState {        // pure data
  tabs: Record<string, Tab>
  panes: Record<string, Pane>
  layout: LayoutNode
  activePaneId: string
}
export interface TabActions { ... }   // all action signatures
export type TabStoreState = TabState & TabActions   // intersection

// Type guards in types.ts
export function isPaneNode(node: LayoutNode): node is PaneNode { return node.type === 'pane' }
```

## Selector Pattern (Curried)
```typescript
// model/selectors.ts — accept TabState (data-only), not TabStoreState
export const selectTab =
  (tabId: string) => (s: TabState): Tab | undefined => s.tabs[tabId]

export const selectActiveTab =
  (paneId?: string) => (s: TabState): Tab | undefined => {
    const id = paneId ?? s.activePaneId
    return s.tabs[s.panes[id]?.activeTabId ?? '']
  }

// Non-curried for simple selectors
export const selectActivePane = (s: TabState): Pane | undefined => s.panes[s.activePaneId]
```
- In actions: `selectTab(id)(get())`
- In components: `useTabStore(selectActiveTab())`

## persist Store (shared)
```typescript
// shared/store/current-workspace.ts
export const useCurrentWorkspaceStore = create<CurrentWorkspaceStore>()(
  persist((set) => ({
    currentWorkspaceId: null,
    setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
    clearCurrentWorkspaceId: () => set({ currentWorkspaceId: null })
  }), {
    name: 'current-workspace',
    storage: createJSONStorage(() => localStorage)
  })
)
```
