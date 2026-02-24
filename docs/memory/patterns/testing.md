# Testing Patterns

## Vitest Config Split

- **web**: `vitest.config.web.mts` — `environment: 'happy-dom'`, includes `src/renderer/**`
- **node**: `vitest.config.node.mts` — `environment: 'node'`, includes `src/main/**`
- Setup files:
  - web: `src/renderer/src/test/setup.ts` → imports `@testing-library/jest-dom`
  - node: `src/main/__tests__/setup.ts` → in-memory SQLite + migrations + vi.mock

## Store Test Pattern

```typescript
const MAIN_PANE = 'main' // initial pane ID constant
const DASHBOARD_TAB = 'tab-dashboard' // initial tab ID constant

beforeEach(() => {
  useTabStore.getState().reset() // reset store before each test
})

it('새 탭을 추가한다', () => {
  const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })
  const state = useTabStore.getState()
  expect(state.tabs[tabId]).toBeDefined()
  expect(state.panes[MAIN_PANE].activeTabId).toBe(tabId)
})
```

- Test store directly (no React, no renderHook)
- Always reset store in beforeEach

## IPC Mock Pattern

```typescript
const mockGetAll = vi.fn()
const mockCreate = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    workspace: { getAll: mockGetAll, create: mockCreate }
  }
  vi.clearAllMocks()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api // cleanup
})

// Mock return value
mockGetAll.mockResolvedValue({ success: true, data: [mockWorkspace] })
mockCreate.mockResolvedValue({ success: false, errorType: 'UnknownError', message: '실패' })
```

## React Query Hook Test Pattern

```typescript
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

it('워크스페이스를 생성한다', async () => {
  mockCreate.mockResolvedValue({ success: true, data: { id: 'new-id', name: 'Test' } })
  const { result } = renderHook(() => useCreateWorkspace(), { wrapper: createWrapper() })
  act(() => result.current.mutate('Test'))
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})
```

## UI Component Test Pattern

```typescript
function setup(props: Partial<Props> = {}) {
  const defaultProps = { open: true, onOpenChange: vi.fn(), onCreated: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return render(createElement(CreateWorkspaceDialog, { ...defaultProps, ...props }), { wrapper })
}

it('이름 입력 후 제출하면 createWorkspace가 호출된다', async () => {
  const { getByRole, getByLabelText } = setup()
  await userEvent.type(getByLabelText('이름'), 'My Workspace')
  await userEvent.click(getByRole('button', { name: '생성' }))
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('My Workspace'))
})
```

## Fixture Helper Pattern

```typescript
// Local helper functions (not extracted to separate file)
function makeTab(overrides?: Partial<Tab>): Tab {
  return { id: 'tab-dashboard', type: 'dashboard', pathname: '/dashboard', ...overrides }
}
function makePane(overrides?: Partial<Pane>): Pane {
  return { id: 'pane-main', tabIds: ['tab-dashboard'], activeTabId: 'tab-dashboard', ...overrides }
}
function makeState(overrides?: Partial<TabState>): TabState {
  return { tabs: { 'tab-dashboard': makeTab() }, panes: { 'pane-main': makePane() }, ... }
}
```

- Naming: `makeXxx(overrides?)`
- Declared locally in test file (no shared fixtures)

## Time Mock Pattern

```typescript
it('lastAccessedAt이 갱신된다', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(5000)
    useTabStore.getState().activateTab(DASHBOARD_TAB)
    expect(useTabStore.getState().tabs[DASHBOARD_TAB].lastAccessedAt).toBe(5000)
  } finally {
    vi.useRealTimers() // always restore in finally
  }
})
```

## Module-level Cache Isolation (sessionIdCache)

```typescript
// Avoid cache collision by using unique IDs per test
const wsId = `ws-create-${Date.now()}-${Math.random()}`
// Or call clearSessionIdCache() after importing it
```

## Test File Location

```
model/__tests__/tab.action.test.ts
model/__tests__/pane.action.test.ts
model/__tests__/layout.test.ts
model/__tests__/selectors.test.ts
api/__tests__/queries.test.ts
lib/__tests__/factory.test.ts
ui/__tests__/ComponentName.test.tsx
```
