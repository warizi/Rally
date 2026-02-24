# Architecture & FSD Patterns

## Layer Structure
```
app/       → Root providers, router, layouts, global styles
pages/     → Route-level full-page components
widgets/   → Complex composite UI (multiple features combined)
features/  → User interaction logic (domain/feature 2-level folder)
entities/  → Domain models + React Query hooks
shared/    → Utils, UI components, global stores
```

## features/ 2-Level Structure
```
features/
├── tap-system/
│   └── manage-tab-system/
│       ├── api/        → raw async IPC functions (no React Query)
│       ├── lib/        → factory.ts, constants.ts
│       ├── model/      → store, actions, selectors, types, hooks
│       └── ui/         → React components
└── workspace/
    └── switch-workspace/
        ├── model/      → custom hooks
        ├── ui/         → Dialog components
        └── index.ts
```

## Import Rules (enforced by ESLint)
- `features` imports from `entities` and `shared` only
- `widgets` imports from `features` and `entities`
- `app` imports from `widgets` and `features`
- NEVER import upward (entities cannot import from features, etc.)

## Path Aliases
```
@/        → src/renderer/src/
@app/     → src/renderer/src/app/
@pages/   → src/renderer/src/pages/
@widgets/ → src/renderer/src/widgets/
@features/→ src/renderer/src/features/
@entities/→ src/renderer/src/entities/
@shared/  → src/renderer/src/shared/
```

## Main Process Structure (3-layer)
```
ipc/workspace.ts          → handle() wrapping, IPC channel registration only
services/workspace.ts     → business logic (validation, error throwing)
repositories/workspace.ts → pure DB CRUD
```

## Note: Tab Routing
React Router only handles `/` route. Actual page routing is done by Zustand tabStore
matching `tab.pathname` against `PANE_ROUTES` array in `shared/lib/pane-route.ts`.
