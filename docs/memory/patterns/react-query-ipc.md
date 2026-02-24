# React Query & IPC Patterns

## IPC Communication Chain
```
Renderer (window.api.xxx())
  → Preload Bridge (ipcRenderer.invoke)
  → Main ipcMain.handle
  → handle(() => service.method())    ← handle wrapper in src/main/lib/handle.ts
  → Repository → SQLite
  → IpcResponse<T>
```

## IpcResponse<T> Type
```typescript
// success: { success: true, data: T }
// failure: { success: false, message: string, errorType: string }
type IpcResponse<T> = { success: true; data?: T } | { success: false; message?: string; errorType?: string }
```

## throwIpcError Pattern
```typescript
// shared/lib/ipc-error.ts
export function throwIpcError(res: IpcResponse): never {
  switch (res.errorType) {
    case 'NotFoundError': throw new NotFoundError(res.message ?? '...')
    case 'ValidationError': throw new ValidationError(res.message ?? '...')
    default: throw new Error(res.message ?? '...')
  }
}
```

## Error Classes (mirrored main ↔ renderer)
- `src/main/lib/errors.ts`: NotFoundError, ValidationError, ConflictError
- `src/renderer/src/shared/lib/errors.ts`: same classes redefined
- IPC boundary loses Error instances → use errorType string to reconstruct

## React Query in entities/ layer
```typescript
// entities/workspace/api/queries.ts
const QUERY_KEY = 'workspaces'

export function useWorkspaces(): UseQueryResult<Workspace[]> {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const res: IpcResponse<Workspace[]> = await window.api.workspace.getAll()
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    }
  })
}

export function useCreateWorkspace(): UseMutationResult<Workspace | undefined, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await window.api.workspace.create(name)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    // update also invalidates single item:
    // onSuccess: (_, { id }) => queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] })
  })
}
```

## queryKeys Style
```typescript
// Simple: string constant
const QUERY_KEY = 'workspaces'
queryKey: [QUERY_KEY]
queryKey: [QUERY_KEY, id]

// Nested: factory object (use-tab-persistence.ts)
export const sessionKeys = {
  all: ['session'] as const,
  session: (workspaceId: string) => [...sessionKeys.all, workspaceId] as const
}
```

## Raw IPC (no React Query) — features/ layer
```typescript
// features/tap-system/manage-tab-system/api/queries.ts
// Pure async functions, not hooks
export async function loadSession(workspaceId: string): Promise<SessionData | null> {
  const res = await window.api.tabSession.getByWorkspaceId(workspaceId)
  if (!res.success) {
    if (res.errorType === 'NotFoundError') return null   // specific error → null
    throwIpcError(res as IpcResponse)
  }
  if (!res.data) throw new Error('Unexpected: missing data')
  // JSON columns in DB need parsing
  const rawTabs = JSON.parse(res.data.tabsJson) as Record<string, SerializedTab>
  return { tabs, panes: ..., layout: ..., activePaneId: ... }
}

export function clearSessionIdCache(): void { sessionIdCache.clear() }  // for tests/HMR
```

## QueryClient Default Config
```typescript
// app/providers/query-client-provider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 5 },  // 5분 stale
    mutations: {
      onSuccess: () => toast.success('성공'),
      onError: (error) => toast.error(error.message)
    }
  }
})
```
- 테스트에서는 `retry: false` 명시 (무한 재시도 방지)

## Main Process handle() wrapper
```typescript
// src/main/lib/handle.ts
export function handle<T>(fn: () => T): IpcResponse<T> {
  try { return successResponse(fn()) }
  catch (e) { return errorResponse(e) }
}

// Usage in ipc/workspace.ts
ipcMain.handle('workspace:create', (_, name: string) =>
  handle(() => workspaceService.create(name)))
```
- Channel naming: `'domain:action'` (camelCase action)
