# File Naming & Barrel Export Patterns

## Naming Conventions

| Target | Convention | Examples |
|--------|-----------|---------|
| Folders | kebab-case | `manage-tab-system/`, `switch-workspace/` |
| React Components | PascalCase.tsx | `TabBar.tsx`, `CreateWorkspaceDialog.tsx` |
| Action files | `domain.action.ts` | `tab.action.ts`, `pane.action.ts` |
| Hook files | kebab-case or camelCase (mixed) | `use-tab-dnd.ts`, `useWorkspaceSwitch.ts` |
| Regular TS files | kebab-case | `ipc-error.ts`, `pane-route.ts` |
| Type files | `domain.type.ts` | `tab.type.ts`, `layout.type.ts` |
| Test folder | `__tests__/` | inside model/, ui/, api/ |
| Test files | `original-name.test.ts(x)` | `tab.action.test.ts` |
| Constants file | `constants.ts` | `lib/constants.ts` |

## Barrel Export Pattern
```typescript
// features/tap-system/manage-tab-system/index.ts
export { useTabStore } from './model/store'
export { selectActiveTab, ... } from './model/selectors'
export type { TabStoreState, TabOptions, SplitPosition } from './model/types'
export { useSessionPersistence, sessionKeys } from './model/use-tab-persistence'
export { TabBar } from './ui/TabBar'
```

```typescript
// entities/workspace/index.ts
export type { Workspace } from './model/types'
export { WorkspaceSchema } from './model/types'
export { useWorkspaces, useCreateWorkspace, ... } from './api/queries'
```
- Each slice's index.ts explicitly declares public API
- External code imports via index: `@entities/workspace`, `@/features/tap-system/manage-tab-system`

## Folder Structure Inside a Feature Slice
```
manage-tab-system/
├── index.ts           ← public API (barrel)
├── api/
│   ├── queries.ts
│   └── __tests__/queries.test.ts
├── lib/
│   ├── factory.ts
│   ├── constants.ts
│   └── __tests__/factory.test.ts
├── model/
│   ├── store.ts
│   ├── types.ts
│   ├── selectors.ts
│   ├── tab.action.ts
│   ├── pane.action.ts
│   ├── layout.action.ts
│   ├── layout.ts         ← layout utility functions
│   ├── use-tab-persistence.ts
│   ├── use-tab-dnd.ts
│   └── __tests__/
└── ui/
    ├── TabBar.tsx
    ├── TabItem.tsx
    └── __tests__/
```
