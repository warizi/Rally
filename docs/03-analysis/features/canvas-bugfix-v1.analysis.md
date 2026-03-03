# Canvas Bugfix V1 Design Validation Results

> **Document**: `docs/02-design/features/canvas-bugfix-v1.design.md`
> **Plan**: `docs/01-plan/features/canvas-bugfix-v1.plan.md`
> **Validation Date**: 2026-03-03
> **Validator**: bkit-design-validator

---

## Completeness Score: 82/100

---

## 1. Plan-to-Design Coverage

| Plan Fix                                   | Design Section | Status   |
| ------------------------------------------ | -------------- | -------- |
| Fix 1: Node/edge immediate reflection      | Section 2      | Complete |
| Fix 2: Node overlap avoidance              | Section 8      | Complete |
| Fix 3: RefNode content display             | Section 7      | Complete |
| Fix 4: Node resize                         | Section 6      | Complete |
| Fix 5: Edge connection stabilization       | Section 3      | Complete |
| Fix 6: Drag multi-select + Cmd pan         | Section 4      | Complete |
| Fix 7: Selection delete UI + edge feedback | Section 5      | Complete |

**Result**: All 7 fixes from the plan have corresponding design sections. No missing coverage.

---

## 2. Issues Found

### CRITICAL (Implementation Will Fail)

#### C1. `useStore.getState()` is invalid API usage in SelectionToolbar

**File**: Design Section 5.2 - `SelectionToolbar.tsx`

**Problem**: The design proposes this code:

```tsx
const handleDelete = () => {
  deleteElements({
    nodes: useStore.getState().nodes.filter((n) => n.selected),
    edges: useStore.getState().edges.filter((e) => e.selected)
  })
}
```

`useStore` from `@xyflow/react` is a **selector hook**, not a Zustand store object. It does NOT have a `.getState()` method. The hook signature is:

```ts
declare function useStore<StateSlice>(
  selector: (state: ReactFlowState) => StateSlice,
  equalityFn?: ...
): StateSlice
```

**Fix**: Use `useStoreApi()` for imperative access, or use `useReactFlow().getNodes()`/`getEdges()`:

```tsx
import { useReactFlow, useStore } from '@xyflow/react'

export function SelectionToolbar(): React.JSX.Element | null {
  const { deleteElements, getNodes, getEdges } = useReactFlow()

  const selectedNodeCount = useStore((s) => s.nodes.filter((n) => n.selected).length)
  const selectedEdgeCount = useStore((s) => s.edges.filter((e) => e.selected).length)
  const totalSelected = selectedNodeCount + selectedEdgeCount

  if (totalSelected === 0) return null

  const handleDelete = () => {
    deleteElements({
      nodes: getNodes().filter((n) => n.selected),
      edges: getEdges().filter((e) => e.selected)
    })
  }

  // ... rest
}
```

---

#### C2. `NodeDimensionChange.resizing` type is `boolean | undefined`, not just `false`

**File**: Design Section 6.2 - `use-canvas-data.ts` dimensions handling

**Problem**: The design filters dimension changes with this type assertion:

```ts
c.type === 'dimensions' && 'resizing' in c && !c.resizing && !!c.dimensions
```

The type assertion is incorrect. The actual `NodeDimensionChange` type from `@xyflow/system` is:

```ts
type NodeDimensionChange = {
  id: string
  type: 'dimensions'
  dimensions?: Dimensions
  resizing?: boolean
  setAttributes?: boolean | 'width' | 'height'
}
```

The filter logic `!c.resizing` is correct at runtime (catches both `false` and `undefined`), but the type annotation in the filter callback is wrong:

```ts
(c): c is NodeChange & { type: 'dimensions'; dimensions: { width: number; height: number }; resizing: false }
```

`resizing: false` as a type literal is too narrow -- it won't match when `resizing` is `undefined`. The correct type predicate should be:

```ts
;(c): c is NodeDimensionChange & { dimensions: Dimensions } =>
  c.type === 'dimensions' && 'dimensions' in c && !!c.dimensions && !c.resizing
```

**Impact**: TypeScript compilation may not fail (the `as` cast bypasses the check), but the type predicate is semantically wrong and could mislead future developers.

---

#### C3. `deleteElements` returns a Promise -- design ignores it

**File**: Design Section 5.1 and 5.2

**Problem**: The `deleteElements` method from `useReactFlow()` returns `Promise<{ deletedNodes: Node[]; deletedEdges: Edge[] }>`. The design calls it synchronously:

```tsx
onClick={() => deleteElements({ edges: [{ id }] })}
```

This works at runtime (the promise just isn't awaited), but in a controlled flow where `onNodesChange`/`onEdgesChange` handle the actual state update, this is acceptable. **Not strictly a blocker**, but the design should note that `deleteElements` is async.

**Severity downgraded to Warning** since the controlled flow callbacks handle the actual deletion side effects.

---

### WARNING (Improvement Needed)

#### W1. Implementation order differs between Plan and Design

**Plan order**: Fix 1 -> Fix 5 -> Fix 6 -> Fix 7 -> Fix 4 -> Fix 3 -> Fix 2

**Design order**: Fix 1 -> Fix 5 -> Fix 6 -> Fix 7 -> Fix 4 -> Fix 3 -> Fix 2

**Result**: Orders match. No issue.

---

#### W2. `onNodesChange` dependency array mismatch

**File**: Design Section 6.2 - `use-canvas-data.ts`

**Problem**: The current `onNodesChange` callback has this dependency array:

```ts
;[canvasId, updatePositions, removeNode, store]
```

The design proposes adding `updateNode` to handle dimensions:

```ts
;[canvasId, updatePositions, removeNode, updateNode, store]
```

This is correct -- `updateNode` must be added. However, the design does not explicitly note that `updateNode` is already destructured from the hook (line 65 of `use-canvas-data.ts`). This is fine since `updateNode` is already available, but the design should mention it for clarity.

**Action**: Minor -- add a note that `updateNode` is already available in scope from the existing mutations section.

---

#### W3. NodeResizer placement inside node components

**File**: Design Section 6.1

**Problem**: The design says to place `<NodeResizer>` as the "first child inside div". However, looking at the `@xyflow/react` NodeResizer example:

```jsx
<>
  <NodeResizer minWidth={100} minHeight={30} />
  <Handle type="target" position={Position.Left} />
  <div style={{ padding: 10 }}>{data.label}</div>
  <Handle type="source" position={Position.Right} />
</>
```

The official example places `NodeResizer` as a **sibling** at the fragment root level, not inside a styled div. When placed inside a div with `overflow-hidden`, the resize handles may be clipped.

**Recommendation**: For `TextNode`, the current outer div has no `overflow-hidden`, so it should work. For `RefNode`, the outer div has `overflow-hidden` class -- this will clip the resize handles. The design should note that `overflow-hidden` must be removed from the RefNode outer div (or changed to `overflow-visible` for the resize handles to be visible), OR place `<NodeResizer>` outside the main div wrapper using a fragment.

---

#### W4. RefNode `overflow-hidden` conflict with NodeResizer

**File**: `src/renderer/src/widgets/canvas/ui/RefNode.tsx` line 48

The current RefNode outer div has:

```tsx
className={`rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden h-full flex flex-col ...`}
```

The design proposes adding `NodeResizer` inside this div while keeping `overflow-hidden`. The `NodeResizer` renders resize handles that extend outside the node bounds -- `overflow-hidden` will clip them.

**Recommendation**: Remove `overflow-hidden` from the outer div, or use a Fragment wrapper to put `NodeResizer` outside the styled container.

---

#### W5. `panOnDrag={false}` behavior with `panActivationKeyCode`

**File**: Design Section 4.1

The design proposes:

```tsx
panOnDrag={false}
panActivationKeyCode="Meta"
```

Looking at the source code of ReactFlow v12.10.1:

```js
const panActivationKeyPressed = useKeyPress(panActivationKeyCode, { target: win })
const panOnDrag = panActivationKeyPressed || _panOnDrag
```

When `panActivationKeyCode="Meta"` is pressed, `panOnDrag` becomes `true`, which enables panning. But then:

```js
const _selectionOnDrag = selectionOnDrag && panOnDrag !== true
```

When Meta is pressed, `selectionOnDrag` is effectively disabled. This is the correct intended behavior. **No issue** -- confirming the design is correct.

---

#### W6. Missing `selected` prop forwarding in `CustomEdge`

**File**: Design Section 5.1

The current `CustomEdgeComponent` destructures props but does NOT include `selected`:

```tsx
function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
  markerStart
}: EdgeProps)
```

The design correctly adds `selected` to the destructured props. `selected` is indeed part of `EdgeProps` in `@xyflow/react`. This is correct.

---

#### W7. Handle count explosion: 4 handles -> 8 handles per node

**File**: Design Section 3.2

The design changes from 4 handles (2 source + 2 target) to 8 handles (4 source + 4 target). This doubles the DOM elements per node. For canvases with many nodes (e.g., 100+), this could have a noticeable performance impact.

**Recommendation**: Add a note about potential performance impact for large canvases, and consider if `ConnectionMode.Loose` alone (which is already set) could solve the connection issue with fewer handles.

---

#### W8. `findNonOverlappingPosition` could infinite loop

**File**: Design Section 8.1

```ts
while (isOverlapping(x, y)) {
  x += OFFSET
  y += OFFSET
}
```

If nodes fill a diagonal line, this loop could run many iterations. There is no iteration limit.

**Recommendation**: Add a maximum iteration count (e.g., `maxAttempts = 50`) to prevent potential UI freezes.

---

### INFO (Reference)

#### I1. Design correctly handles DB data compatibility

The design's approach to handle ID changes is well-thought-out:

- DB continues to store plain side values: `"top"`, `"right"`, `"bottom"`, `"left"`
- `toCreateCanvasEdgeData` strips `-source`/`-target` suffix before DB write
- `toReactFlowEdge` appends `-source`/`-target` suffix when reading from DB

This bidirectional conversion ensures **zero migration needed** for existing data. Existing edges with `fromSide: "right"`, `toSide: "left"` will correctly map to `sourceHandle: "right-source"`, `targetHandle: "left-target"`.

Verified against the DB schema (`src/main/db/schema/canvas-edge.ts`):

- `fromSide` enum: `['top', 'right', 'bottom', 'left']` -- no changes needed
- `toSide` enum: `['top', 'right', 'bottom', 'left']` -- no changes needed

---

#### I2. All proposed APIs confirmed available in @xyflow/react v12.10.1

| API                         | Export Location                     | Status                              |
| --------------------------- | ----------------------------------- | ----------------------------------- |
| `NodeResizer`               | `additional-components/NodeResizer` | Exported                            |
| `useReactFlow`              | `hooks/useReactFlow`                | Exported, includes `deleteElements` |
| `useStore`                  | `hooks/useStore`                    | Exported (selector hook)            |
| `useStoreApi`               | `hooks/useStore`                    | Exported (imperative access)        |
| `EdgeLabelRenderer`         | `components/EdgeLabelRenderer`      | Exported                            |
| `BaseEdge`                  | `components/Edges/BaseEdge`         | Exported                            |
| `getBezierPath`             | Re-exported from `@xyflow/system`   | Available                           |
| `panOnDrag` prop            | `types/component-props.d.ts`        | `boolean \| number[]`               |
| `selectionOnDrag` prop      | `types/component-props.d.ts`        | `boolean`                           |
| `panActivationKeyCode` prop | `types/component-props.d.ts`        | `KeyCode \| null`                   |

---

#### I3. `UpdateCanvasNodeData` already supports `width`/`height`

Verified in `src/renderer/src/entities/canvas/model/types.ts`:

```ts
export interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}
```

No backend changes needed for resize persistence. Design is correct.

---

#### I4. `NodeDimensionChange` type confirmed in @xyflow/system

The `dimensions` change type is real and fires during resize. The type structure is:

```ts
type NodeDimensionChange = {
  id: string
  type: 'dimensions'
  dimensions?: Dimensions // { width: number; height: number }
  resizing?: boolean
  setAttributes?: boolean | 'width' | 'height'
}
```

The `resizing: false` event fires when resize ends -- this is when the design saves to DB. Correct approach.

---

#### I5. Code snippet line references are accurate

The design references "lines 76-83" for the hydration code in `use-canvas-data.ts`. Actual lines are 76-83. Verified match:

| Design Reference                     | Actual Location | Match |
| ------------------------------------ | --------------- | ----- |
| `hydratedRef` (line 76)              | Line 76         | Exact |
| `useEffect` hydration (line 77)      | Line 77         | Exact |
| `isLoading \|\| hydratedRef.current` | Line 78         | Exact |
| `setHydrated(true)` (line 82)        | Line 82         | Exact |

---

## 3. Code Accuracy Verification

### File paths in design vs actual codebase

| Design Path                               | Exists        | Content Match                                    |
| ----------------------------------------- | ------------- | ------------------------------------------------ |
| `widgets/canvas/model/use-canvas-data.ts` | Yes           | Code snippets match                              |
| `widgets/canvas/ui/CanvasBoard.tsx`       | Yes           | Structure matches                                |
| `widgets/canvas/ui/TextNode.tsx`          | Yes           | Handle layout matches                            |
| `widgets/canvas/ui/RefNode.tsx`           | Yes           | Handle layout + content area matches             |
| `widgets/canvas/ui/CustomEdge.tsx`        | Yes           | Missing `selected` prop confirmed                |
| `entities/canvas/model/converters.ts`     | Yes           | `toReactFlowEdge`/`toCreateCanvasEdgeData` match |
| `entities/canvas/model/types.ts`          | Yes           | Types match                                      |
| `widgets/canvas/ui/SelectionToolbar.tsx`  | No (new file) | Correct -- marked as new                         |

### Current code snippets accuracy

| Design "Before" Code                                                    | Actual Current Code            | Match                              |
| ----------------------------------------------------------------------- | ------------------------------ | ---------------------------------- |
| TextNode handles (top=target, left=target, bottom=source, right=source) | Lines 39-42 of TextNode.tsx    | Exact match                        |
| RefNode handles (same pattern)                                          | Lines 55-58 of RefNode.tsx     | Exact match                        |
| RefNode content area (`overflow-hidden`, `line-clamp-3`)                | Lines 64-73 of RefNode.tsx     | Exact match                        |
| CustomEdge missing `selected`                                           | Lines 9-21 of CustomEdge.tsx   | Confirmed -- no `selected`         |
| `toReactFlowEdge` using bare `fromSide`/`toSide`                        | Lines 31-32 of converters.ts   | Exact match                        |
| `toCreateCanvasEdgeData` direct cast                                    | Lines 74-75 of converters.ts   | Exact match                        |
| `onNodesChange` dependency array                                        | Line 131 of use-canvas-data.ts | Exact match (missing `updateNode`) |

---

## 4. Checklist Results

- [x] Plan-Design coverage: All fixes covered
- [x] File paths: All correct and verified
- [x] Code snippets: "Before" code matches actual codebase
- [x] API availability: All @xyflow/react APIs confirmed in v12.10.1
- [x] DB compatibility: Converter-based approach maintains backward compatibility
- [x] Type definitions: `UpdateCanvasNodeData` already has width/height
- [ ] `useStore.getState()` usage: INCORRECT -- must use `useStoreApi()` or `useReactFlow()`
- [ ] NodeResizer + overflow-hidden conflict: Not addressed for RefNode
- [x] No new packages needed: Confirmed
- [x] No DB schema changes: Confirmed
- [x] No IPC changes: Confirmed

---

## 5. Recommendations

1. **[MUST FIX]** Replace `useStore.getState()` with `useReactFlow().getNodes()`/`.getEdges()` in `SelectionToolbar.tsx` design. The `useStore` hook from `@xyflow/react` does NOT expose `.getState()`.

2. **[MUST FIX]** Address `overflow-hidden` on RefNode outer div when adding `NodeResizer`. Either remove `overflow-hidden` or restructure to use a Fragment wrapper with `NodeResizer` outside the clipping container.

3. **[SHOULD FIX]** Fix the TypeScript type predicate for dimension change filtering to use `NodeDimensionChange & { dimensions: Dimensions }` instead of the incorrect literal type `{ resizing: false }`.

4. **[SHOULD FIX]** Add iteration limit to `findNonOverlappingPosition` while-loop to prevent potential infinite loops.

5. **[CONSIDER]** Note that `deleteElements` returns a Promise. While not blocking in a controlled flow, explicit `void` annotation or comment would improve code clarity.

6. **[CONSIDER]** Evaluate whether 8 handles per node (vs current 4) has meaningful performance impact for the expected canvas sizes. If canvases typically have fewer than 50 nodes, this is negligible.

---

## Post-Validation Assessment

**Score: 82/100** -- Implementation possible after fixing Critical items C1 and addressing Warning items W3/W4.

| Threshold                  | Status           |
| -------------------------- | ---------------- |
| < 70: Block implementation | --               |
| 70-89: Fix warnings first  | **Current (82)** |
| >= 90: Approved            | --               |

**Verdict**: Fix the `useStore.getState()` API misuse (C1) and the `overflow-hidden` conflict (W3/W4) in the design document, then proceed to implementation.
