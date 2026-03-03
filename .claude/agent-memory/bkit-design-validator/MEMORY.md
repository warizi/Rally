# Design Validator Memory

## Project: Rally (Electron + React + SQLite)

### Key Libraries for API Validation

- `@xyflow/react` v12.10.1: `useStore` is a selector hook (NOT a store with `.getState()`). Use `useStoreApi()` for imperative access or `useReactFlow()` helpers.
- `deleteElements` from `useReactFlow()` returns a `Promise`.
- `NodeResizer` renders handles outside node bounds -- `overflow-hidden` on parent will clip them.
- `NodeDimensionChange.resizing` is `boolean | undefined`, not just `false`.

### Validation Patterns

- Always verify "before" code snippets against actual file line numbers
- Check DB schema enums when handle ID / side value changes are proposed
- Converter-based compatibility (strip/append suffixes) avoids DB migrations

### File Structure

- Canvas widgets: `src/renderer/src/widgets/canvas/`
- Canvas entities: `src/renderer/src/entities/canvas/`
- DB schema: `src/main/db/schema/`
