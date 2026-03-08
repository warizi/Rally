# Project-Unique Patterns

## Tab ID = pathname-based unique key

```typescript
// lib/factory.ts
export function createTabId(pathname: string): string {
  return `tab-${pathname
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}`
}
// '/dashboard' → 'tab-dashboard'
// '/todo/123'  → 'tab-todo-123'
```

- Prevents duplicate tabs: same pathname = same ID
- Used to deduplicate in `openTab`, `navigateTab`

## Tab Routing (Zustand-based, not React Router)

- React Router only handles `/` route (hash-based)
- Tab navigation via `tabStore.openTab({ pathname })` or `navigateTab()`
- Page rendering: `PaneLayout` matches `tab.pathname` against `PANE_ROUTES`

```typescript
// shared/lib/pane-route.ts
export const PANE_ROUTES: PaneRoute[] = [
  { pattern: '/dashboard', component: DashboardPage },
  { pattern: '/todo', component: TodoPage },
  { pattern: '/folder/:id', component: FolderPage }
]
```

## Custom Throttle with flush()

```typescript
// model/use-tab-persistence.ts
interface Throttled { (): void; cancel(): void; flush(): void }
function createThrottle(fn: () => void, ms: number): Throttled { ... }

// flush() called on beforeunload to guarantee save before app close
const throttledSave = createThrottle(() => flushSession(currentWsId), 2000)
window.addEventListener('beforeunload', () => throttledSave.flush())
```

- Module-level `currentWsId` variable (outside React)

## sessionIdCache — Create/Update Branching

```typescript
// api/queries.ts
const sessionIdCache = new Map<string, number>() // module-level singleton

export async function saveSession(workspaceId: string, data: SessionData): Promise<void> {
  const existingId = sessionIdCache.get(workspaceId)
  if (existingId != null) {
    await window.api.tabSession.update({ id: existingId, ...payload }) // UPDATE
  } else {
    const res = await window.api.tabSession.create(payload) // INSERT
    if (res.data) sessionIdCache.set(workspaceId, res.data.id)
  }
}

export function clearSessionIdCache(): void {
  sessionIdCache.clear()
} // for tests/HMR
```

## Error Class Mirroring (main ↔ renderer)

- Error classes defined in `src/main/lib/errors.ts` AND `src/renderer/src/shared/lib/errors.ts`
- IPC boundary serializes errors → send `errorType: string` → reconstruct on renderer side
- `throwIpcError(res)` converts errorType string back to proper Error class

## WorkspaceInitializer (null-return component)

```typescript
// app/providers/workspace-initializer.tsx
export function WorkspaceInitializer(): null {
  // Validates current workspace ID on mount
  // Auto-switches to first workspace if invalid
  return null
}
```

## SQLite JSON Column Pattern

```typescript
// Session data stored as JSON strings in DB columns
interface TabSession {
  tabsJson: string // JSON.stringify(Record<string, Tab>)
  panesJson: string // JSON.stringify(Record<string, Pane>)
  layoutJson: string // JSON.stringify(LayoutNode)
  activePaneId: string
}

// Restore icon from type on load (backwards compat)
const rawTabs = JSON.parse(session.tabsJson) as Record<string, SerializedTab>
const tabs = Object.fromEntries(
  Object.entries(rawTabs).map(([k, t]) => [k, { ...t, icon: t.icon ?? t.type }])
)
```

## Initial State via Factory

```typescript
// lib/factory.ts
export function createInitialState(): TabState {
  const dashboardTab = createTab({ type: 'dashboard', pathname: '/dashboard', title: '대시보드' })
  const mainPane = createPane({
    id: 'main',
    tabIds: [dashboardTab.id],
    activeTabId: dashboardTab.id
  })
  return {
    tabs: { [dashboardTab.id]: dashboardTab },
    panes: { [mainPane.id]: mainPane },
    layout,
    activePaneId: 'main'
  }
}
// LAYOUT_DEFAULTS.DEFAULT_PANE_ID = 'main'
```

- `reset()` calls `createInitialState()` to get fresh state
