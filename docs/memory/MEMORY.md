# Rally Project Memory

## Project Overview
- **Type**: Electron desktop app (React + TypeScript + SQLite)
- **Architecture**: FSD (Feature-Sliced Design)
- **Key libs**: Zustand v5, TanStack React Query v5, Tailwind CSS v4, shadcn/ui, Drizzle ORM
- **Testing**: Vitest + happy-dom (web), Vitest + node (main)

## Key Files
- Path aliases: `@/` → src/renderer/src/, `@shared/` → src/renderer/src/shared/
- Router: Hash-based (Electron), only `/` route — tab routing via Zustand store
- DB schema: `src/main/db/schema/index.ts`
- Preload bridge types: `src/preload/index.d.ts`
- Global styles: `src/renderer/src/app/styles/global.css`
- Vitest web config: `vitest.config.web.mts` (environment: happy-dom)

## Detailed Pattern Files
- [Architecture & FSD](./patterns/architecture.md)
- [State Management (Zustand)](./patterns/state-management.md)
- [React Query & IPC](./patterns/react-query-ipc.md)
- [DB & Service Layer](./patterns/db-service.md)
- [Testing Patterns](./patterns/testing.md)
- [Component Patterns](./patterns/components.md)
- [File Naming & Barrel Exports](./patterns/naming.md)
- [Project-Unique Patterns](./patterns/unique.md)

## Quick Reference

### Zustand Store Structure
```
store.ts = createInitialState() + createXxxActions(set, get) * N + reset + selector wrappers
types.ts = TabState (data) + TabActions (methods) → TabStoreState = TabState & TabActions
selectors.ts = curried: (arg) => (state: TabState) => result
```

### IPC Chain
```
window.api.xxx() → preload bridge → ipcMain.handle → handle(()=>service.method()) → IpcResponse<T>
```

### Test Core Patterns
```typescript
beforeEach(() => useTabStore.getState().reset())  // store reset
(window as unknown as Record<string, unknown>).api = { tabSession: { ... } }  // IPC mock
afterEach(() => delete (window as unknown as Record<string, unknown>).api)
vi.useFakeTimers() / vi.setSystemTime(5000) / vi.useRealTimers()  // time mock
```

### DB Layer (main process)
```
schema/       → Drizzle table definitions (type: typeof table.$inferSelect)
repositories/ → pure CRUD (findAll/findById/create/update/delete)
services/     → business logic (validation, nanoid ID, new Date(), Custom Errors)
ipc/          → handle() wrapper + ipcMain.handle registration
```

### File Naming
- Folders: kebab-case
- Components: PascalCase.tsx
- Actions: `domain.action.ts`
- Type files: `domain.type.ts`
- Hooks: `use-hook-name.ts` or `useHookName.ts` (mixed)
- Tests: `__tests__/original-name.test.ts`

### Key Dependencies
- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` (TabBar drag/drop)
- Animation: `framer-motion` AnimatePresence mode="popLayout" (tab enter/exit)
- ID gen: `nanoid()` (service layer)
- Validation: `zod` + `react-hook-form` + `@hookform/resolvers/zod` (Dialog forms)
