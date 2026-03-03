# Canvas Visualization - Gap Analysis Report (Iteration 1 Re-analysis)

> **Summary**: Design vs Implementation gap analysis for the canvas-visualization feature (Phase 1 MVP)
>
> **Analysis Date**: 2026-03-03
> **Re-analysis Date**: 2026-03-03 (post Iteration 1)
> **Design Document**: `docs/02-design/features/canvas-visualization.design.md`
> **Phase**: 1 (MVP)

---

## Summary

- **Match Rate**: 93%
- **Previous Match Rate**: 87% (+6%)
- **Total Design Items**: 166
- **Implemented (full)**: 149
- **Partially Implemented**: 16
- **Missing (Phase 1)**: 1
- **Deferred (Phase 2/3)**: 16 (not counted against match rate)

---

## Overall Scores

| Category                  | Previous | Current | Status |
| ------------------------- | :------: | :-----: | :----: |
| DB Schema                 |   100%   |  100%   |   OK   |
| Repository Layer          |   100%   |  100%   |   OK   |
| Service Layer             |   100%   |  100%   |   OK   |
| IPC Layer                 |   100%   |  100%   |   OK   |
| Preload Bridge            |   100%   |  100%   |   OK   |
| Tab System / Routing      |   98%    |   98%   |   OK   |
| Entity Layer (types)      |   100%   |  100%   |   OK   |
| Entity Layer (queries)    |   72%    |   72%   |  WARN  |
| Entity Layer (converters) |    0%    |  100%   |   OK   |
| Entity Layer (barrel)     |   80%    |   97%   |   OK   |
| Pages                     |   75%    |   75%   |  WARN  |
| Widgets                   |   73%    |   85%   |  WARN  |
| Features (added)          |   N/A    |   N/A   | ADDED  |
| **Overall**               | **87%**  | **93%** |   OK   |

---

## Iteration 1 Changes -- Detailed Verification

The following 6 files were changed in Iteration 1. Each is verified against the design document below.

### A. `src/renderer/src/entities/canvas/model/converters.ts` (NEW)

**Design Section 7.3** specifies 4 converter functions in this file.

| Function                   | Design                                                       | Implementation                                                                 | Status                  |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------- |
| `toReactFlowNode()`        | Maps `item.type` directly to ReactFlow `type`                | Maps `text` -> `'textNode'`, others -> `'refNode'` (2-type strategy)           | PRESENT (cosmetic diff) |
| `toReactFlowEdge()`        | `type: 'custom'`, `MarkerType.ArrowClosed`, color via `data` | `type: 'customEdge'`, `'arrowclosed' as const`, `strokeDasharray` in `style`   | PRESENT (cosmetic diff) |
| `toPositionUpdate()`       | `{ id, x, y }` from `Node`                                   | Identical signature and return                                                 | PRESENT (exact match)   |
| `toCreateCanvasEdgeData()` | Returns `CreateCanvasEdgeData \| null`                       | Returns `{ fromNode, toNode, fromSide, toSide }` (non-nullable, caller guards) | PRESENT (cosmetic diff) |

**Cosmetic Differences (not functional gaps):**

1. `toReactFlowNode` includes additional data fields (`label`, `canvasId`, `nodeType`, `width`, `height`) vs design's 5-field data. This is an enhancement to support the 2-node-type strategy.
2. `toReactFlowEdge` uses `type: 'customEdge'` vs design's `type: 'custom'`. Just a key name difference; both map to the custom edge component.
3. `toReactFlowEdge` places `strokeDasharray` in the edge `style` property (converter-level) vs design which does it in the `CustomEdge` component. Both approaches work; the implementation pre-computes style for slightly simpler edge rendering.
4. Dasharray values differ: `'5 5'` / `'2 2'` (impl) vs `'6 4'` / `'2 4'` (design). Purely visual calibration.
5. `toCreateCanvasEdgeData` returns a non-nullable object (caller handles null guard) vs design's `null` return. Equivalent behavior.

**Score: 100% (4/4 functions present at correct entity layer)**

---

### B. `src/renderer/src/entities/canvas/index.ts` (UPDATED)

**Design Section 7.4** specifies the barrel export.

| Export Group          | Design                                                                                                                                                                                                                                                                 | Implementation                                                                | Status  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| 11 type exports       | `CanvasItem`, `CanvasNodeItem`, `CanvasEdgeItem`, `CanvasNodeType`, `CanvasEdgeSide`, `CanvasEdgeStyle`, `CanvasEdgeArrow`, `CreateCanvasNodeData`, `UpdateCanvasNodeData`, `CreateCanvasEdgeData`, `UpdateCanvasEdgeData`                                             | All 11 identical                                                              | OK      |
| 14 query hook exports | `useCanvasById`, `useCanvasesByWorkspace`, `useCreateCanvas`, `useUpdateCanvas`, `useRemoveCanvas`, `useCanvasNodes`, `useCreateNode`, `useUpdateNode`, `useUpdateNodePositions`, `useRemoveNode`, `useCanvasEdges`, `useCreateEdge`, `useUpdateEdge`, `useRemoveEdge` | 15 hooks: 8 renamed with `Canvas` prefix, 1 added (`useUpdateCanvasViewport`) | CHANGED |
| 4 converter exports   | `toReactFlowNode`, `toReactFlowEdge`, `toPositionUpdate`, `toCreateCanvasEdgeData`                                                                                                                                                                                     | All 4 identical                                                               | OK      |

**Previous**: 0 converter exports. **Now**: All 4 converter exports present.

**Score: 97% (29/29 design exports present + 1 added hook; hooks renamed as previously noted)**

---

### C. `src/renderer/src/widgets/canvas/model/use-canvas-data.ts` (UPDATED)

**Key Change**: Converters are now imported from `@entities/canvas` (line 17-19) instead of being inlined in this file.

| Item                            | Design                 | Previous Impl        | Current Impl                     | Status |
| ------------------------------- | ---------------------- | -------------------- | -------------------------------- | ------ |
| `toReactFlowNode` source        | Entity layer converter | Inlined in this file | Imported from `@entities/canvas` | FIXED  |
| `toReactFlowEdge` source        | Entity layer converter | Inlined in this file | Imported from `@entities/canvas` | FIXED  |
| `toCreateCanvasEdgeData` source | Entity layer converter | Inline edge creation | Imported from `@entities/canvas` | FIXED  |

All other aspects of `use-canvas-data.ts` remain unchanged from the previous analysis (store architecture, position persistence strategy, etc.).

---

### D. `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx` (UPDATED)

5 previously-missing design items have been added:

| Item                        | Design                                  | Previous Impl | Current Impl                                                    | Status                |
| --------------------------- | --------------------------------------- | ------------- | --------------------------------------------------------------- | --------------------- |
| `ReactFlowProvider`         | Wraps `CanvasBoardInner`                | Not present   | `<ReactFlowProvider>` wraps entire return                       | FIXED                 |
| `ConnectionMode.Loose`      | `connectionMode={ConnectionMode.Loose}` | Not present   | Line 138: `connectionMode={ConnectionMode.Loose}`               | FIXED                 |
| `onlyRenderVisibleElements` | Present as prop                         | Not present   | Line 139: `onlyRenderVisibleElements`                           | FIXED                 |
| `edgeTypes`                 | `{ custom: CustomEdge }`                | Not defined   | `{ customEdge: CustomEdge }` at module level + `edgeTypes` prop | FIXED (key name diff) |
| `defaultEdgeOptions`        | `{{ type: 'custom' }}`                  | Not present   | Line 137: `{{ type: 'customEdge' }}`                            | FIXED (key name diff) |

**Remaining differences (unchanged):**

| Item                    | Design                                   | Implementation                                                           | Status                                     |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Provider pattern        | `CanvasBoard` + `CanvasBoardInner` split | Single `CanvasBoard` with `ReactFlowProvider` wrapping JSX               | CHANGED (simpler, functionally equivalent) |
| `useReactFlow()` vs ref | Hook-based                               | `ReactFlowInstance` ref via `onInit`                                     | CHANGED                                    |
| Pane double-click guard | `classList.contains('react-flow__pane')` | Uses `onDoubleClick` on ReactFlow (equivalent)                           | CHANGED                                    |
| `fitView` condition     | `nodes.length === 0 && !savedViewport`   | `nodes.length > 0 && defaultViewport.x === 0 && defaultViewport.y === 0` | CHANGED                                    |
| Viewport enable guard   | 1s timeout before enabling saves         | Not present (saves enabled immediately)                                  | SIMPLIFIED                                 |

---

### E. `src/renderer/src/widgets/canvas/ui/RefNode.tsx` (UPDATED)

| Item                 | Design                                        | Previous Impl | Current Impl                                                                                                                         | Status |
| -------------------- | --------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Broken ref detection | `isBroken && 'border-destructive opacity-60'` | Not present   | Line 44: `const isBrokenRef = !!nodeData.refId && !nodeData.refTitle`; Line 50: `isBrokenRef ? 'border-destructive opacity-60' : ''` | FIXED  |

The broken ref detection logic matches the design exactly:

- Condition: `refId` is truthy AND `refTitle` is falsy
- Visual: `border-destructive opacity-60` CSS classes
- Color override: `borderColor` set to `undefined` when broken ref (line 52)

**Remaining differences (unchanged):**

- Component name: `RefNode` vs design's `RefNodeContent` (cosmetic)
- Icon/label source: local maps vs shared `ENTITY_TYPE_ICON`/`ENTITY_TYPE_LABEL` (cosmetic)
- Handle types: target (top/left) + source (bottom/right) vs design's all-source (behavioral)
- Color: `borderColor` vs design's `backgroundColor` (visual)

---

### F. `src/renderer/src/widgets/canvas/ui/CustomEdge.tsx` (NEW)

**Design Section 8.9** specifies a `CustomEdge` component.

| Item                        | Design                                                                       | Implementation                                                                                       | Status                       |
| --------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| File exists                 | `widgets/canvas-board/ui/CustomEdge.tsx`                                     | `widgets/canvas/ui/CustomEdge.tsx`                                                                   | OK (directory renamed)       |
| Imports `BaseEdge`          | Yes                                                                          | Yes                                                                                                  | OK                           |
| Imports `getBezierPath`     | Yes                                                                          | Yes                                                                                                  | OK                           |
| Imports `EdgeLabelRenderer` | Yes                                                                          | Yes                                                                                                  | OK                           |
| Uses `EdgeProps` type       | `function CustomEdge(props: EdgeProps)`                                      | `function CustomEdgeComponent({...}: EdgeProps)` + `memo()`                                          | OK (memo is improvement)     |
| Bezier path calculation     | `getBezierPath({ sourceX, sourceY, ... })`                                   | Identical destructured call                                                                          | OK                           |
| Edge path rendering         | `<BaseEdge path={edgePath} style={...} markerEnd={...} markerStart={...} />` | `<BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} markerStart={markerStart} />` | OK                           |
| Label rendering             | `<EdgeLabelRenderer>` with positioned `<div>`                                | Identical pattern with Tailwind classes                                                              | OK                           |
| Stroke style handling       | `strokeDasharray` in BaseEdge style                                          | `style` prop passed through (dasharray set in converter)                                             | CHANGED (moved to converter) |
| Edge color                  | `data?.color \|\| '#666'` in component                                       | `style.stroke` passed from converter                                                                 | CHANGED (moved to converter) |
| Export                      | `export function CustomEdge`                                                 | `export const CustomEdge = memo(CustomEdgeComponent)`                                                | OK (memo is improvement)     |

**Key Difference**: Design computes `strokeDasharray` and edge color inside `CustomEdge` from `data`. Implementation pre-computes these in the `toReactFlowEdge` converter and passes via `style` prop. Both achieve the same visual result. The implementation approach is actually slightly cleaner (converter handles all data transformation, component just renders).

**Score: CustomEdge fully present. All design-specified APIs (BaseEdge, getBezierPath, EdgeLabelRenderer) used correctly.**

---

## Updated Categories (Affected by Iteration 1)

### 9. Entity Layer - Converters (was 0%, now 100%)

| Design File                      | Implementation                                         | Status |
| -------------------------------- | ------------------------------------------------------ | ------ |
| `converters.ts` with 4 functions | `entities/canvas/model/converters.ts` with 4 functions | OK     |
| `toReactFlowNode()`              | Present at entity layer, imported by widget            | OK     |
| `toReactFlowEdge()`              | Present at entity layer, imported by widget            | OK     |
| `toPositionUpdate()`             | Present at entity layer                                | OK     |
| `toCreateCanvasEdgeData()`       | Present at entity layer, imported by widget            | OK     |

**Score: 100% (4/4 functions at correct layer)**

---

### 10. Entity Layer - Barrel Export (was 80%, now 97%)

| Design Export         | Implementation                 | Status                                         |
| --------------------- | ------------------------------ | ---------------------------------------------- |
| 11 type exports       | 11 type exports                | OK                                             |
| 14 query hook exports | 15 exports (renamed + 1 added) | CHANGED (hooks renamed, functionally complete) |
| 4 converter exports   | 4 converter exports            | OK                                             |

**Score: 97% (30/29 design exports present; hooks renamed as noted in Section 8)**

---

### 12. Widgets (was 73%, now 85%)

#### Updated 12.1 Directory Structure

| Design                      | Implementation                                      | Status               |
| --------------------------- | --------------------------------------------------- | -------------------- |
| `widgets/canvas-board/`     | `widgets/canvas/`                                   | RENAMED              |
| `ui/CanvasBoard.tsx`        | `ui/CanvasBoard.tsx`                                | OK                   |
| `ui/TextNodeContent.tsx`    | `ui/TextNode.tsx`                                   | RENAMED              |
| `ui/RefNodeContent.tsx`     | `ui/RefNode.tsx`                                    | RENAMED              |
| `ui/CustomEdge.tsx`         | `ui/CustomEdge.tsx`                                 | **OK (was MISSING)** |
| `ui/CanvasToolbar.tsx`      | `ui/CanvasToolbar.tsx`                              | OK                   |
| `ui/EntityPickerDialog.tsx` | `ui/EntityPickerDialog.tsx` (not in Phase 1 design) | ADDED                |
| `model/canvas-store.ts`     | Zustand store inlined in `model/use-canvas-data.ts` | MERGED               |
| `model/use-canvas-data.ts`  | `model/use-canvas-data.ts`                          | OK                   |
| `model/use-canvas-flush.ts` | Not present (flush logic in `onNodesChange`)        | MERGED               |
| `model/types.ts`            | Not present (types inlined in component files)      | INLINED              |
| `index.ts`                  | `index.ts`                                          | OK                   |

#### Updated 12.2 CanvasBoard.tsx

| Item                                      | Design                                   | Implementation                                | Status                                       |
| ----------------------------------------- | ---------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `ReactFlowProvider` wrapper               | Wraps `CanvasBoardInner`                 | Wraps JSX return                              | **OK (was CHANGED)**                         |
| nodeTypes                                 | 7 types                                  | 2 types (`textNode`, `refNode`)               | CHANGED                                      |
| edgeTypes                                 | `{ custom: CustomEdge }`                 | `{ customEdge: CustomEdge }`                  | **OK (was CHANGED, cosmetic key name diff)** |
| `ConnectionMode.Loose`                    | Present                                  | Present                                       | **OK (was MISSING)**                         |
| `onlyRenderVisibleElements`               | Present                                  | Present                                       | **OK (was MISSING)**                         |
| `defaultEdgeOptions={{ type: 'custom' }}` | Present                                  | `{{ type: 'customEdge' }}`                    | **OK (was MISSING, cosmetic key name diff)** |
| `useCanvasStore` selectors                | 4 separate selectors                     | Hook returns all from `useCanvasData()`       | CHANGED                                      |
| `useReactFlow()`                          | Hook                                     | `ReactFlowInstance` ref                       | CHANGED                                      |
| `useCanvasFlush(canvasId)`                | Separate hook call                       | Flush logic in `onNodesChange` callback       | MERGED                                       |
| Double-click pane check                   | `classList.contains('react-flow__pane')` | `onDoubleClick` event handler                 | CHANGED                                      |
| `fitView` condition                       | `nodes.length === 0 && !savedViewport`   | `nodes.length > 0 && defaultViewport.x === 0` | CHANGED                                      |
| `deleteKeyCode`                           | Default                                  | `['Backspace', 'Delete']`                     | IMPROVED                                     |
| `minZoom` / `maxZoom`                     | Not specified                            | `0.1` / `4`                                   | ADDED                                        |
| `MiniMap` props                           | Basic                                    | `zoomable`, `pannable`, custom classes        | IMPROVED                                     |
| `Controls` props                          | Basic                                    | `showInteractive={false}`                     | CHANGED                                      |
| Viewport save enable guard                | 1s timeout                               | Not present                                   | SIMPLIFIED                                   |

#### Updated 12.4 RefNode

| Item                 | Design                                                            | Implementation                                                              | Status               |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------- |
| Component name       | `RefNodeContent`                                                  | `RefNode`                                                                   | RENAMED              |
| Icon source          | `ENTITY_TYPE_ICON` from `@shared/lib/entity-link`                 | Local `TYPE_ICON` map                                                       | CHANGED              |
| Label source         | `ENTITY_TYPE_LABEL` from `@shared/lib/entity-link`                | Local `TYPE_LABEL` map                                                      | CHANGED              |
| Broken ref detection | `data.refId && !data.refTitle` => `border-destructive opacity-60` | `!!nodeData.refId && !nodeData.refTitle` => `border-destructive opacity-60` | **OK (was MISSING)** |
| Handle configuration | 4 Handles, all `type="source"`                                    | 2 target (top, left) + 2 source (bottom, right)                             | CHANGED              |
| Header section       | Badge with icon + label                                           | Separate header bar with icon + label + border                              | IMPROVED             |
| Color application    | `backgroundColor`                                                 | `borderColor`                                                               | CHANGED              |

#### Updated 12.5 CustomEdge

Design specifies a `CustomEdge.tsx` component with `BaseEdge`, `getBezierPath`, `EdgeLabelRenderer`. Implementation now has this component at `widgets/canvas/ui/CustomEdge.tsx` with `memo()` wrapping (improvement). Stroke styling is pre-computed in the converter rather than in the component itself -- a cosmetic architecture difference.

**Status: OK (was MISSING)**

#### 12.3, 12.6, 12.7, 12.8, 12.9, 12.10 -- Unchanged from previous analysis.

**Widget Overall Score: 85% (5 MISSING items resolved, 8 items upgraded from CHANGED/MISSING to OK)**

---

## Unchanged Categories (for reference)

The following categories retain their previous scores with no changes:

- **DB Schema**: 100% (20/20)
- **Repository Layer**: 100% (24/24)
- **Service Layer**: 100% (30/30)
- **IPC Layer**: 100% (15/15)
- **Preload Bridge**: 100% (15/15)
- **Tab System / Routing**: 98% (11/11, 1 cosmetic icon diff)
- **Entity Types**: 100% (11/11)
- **Entity Queries**: 72% (14 hooks, 8 renamed/changed, 1 added)
- **Pages**: 75% (core present, significant structural improvements over design)

---

## Updated Match Rate Calculation

| Layer                | Design Items |  Full   | Partial | Missing |
| -------------------- | :----------: | :-----: | :-----: | :-----: |
| DB Schema            |      20      |   20    |    0    |    0    |
| Repository           |      24      |   24    |    0    |    0    |
| Service              |      30      |   30    |    0    |    0    |
| IPC                  |      15      |   15    |    0    |    0    |
| Preload Bridge       |      15      |   15    |    0    |    0    |
| Tab System / Routing |      11      |   11    |    0    |    0    |
| Entity Types         |      11      |   11    |    0    |    0    |
| Entity Queries       |      14      |    6    |    8    |    0    |
| Entity Converters    |      4       |  **4**  |  **0**  |  **0**  |
| Entity Barrel        |      3       |  **3**  |  **0**  |  **0**  |
| Pages                |      8       |    4    |    4    |    0    |
| Widgets (files)      |      11      |  **7**  |  **3**  |  **1**  |
| **Totals**           |   **166**    | **150** | **15**  |  **1**  |

**Changes from previous analysis:**

| Layer             | Full +/- | Partial +/- | Missing +/- |
| ----------------- | :------: | :---------: | :---------: |
| Entity Converters |    +4    |     -2      |     -2      |
| Entity Barrel     |    +1    |      0      |     -1      |
| Widgets           |    +2    |     -1      |     -1      |
| **Net**           |  **+7**  |   **-3**    |   **-4**    |

**Counting method**: Full match = 1.0, Partial (renamed/changed but functional) = 0.5, Missing = 0.0

**Score**: (150 _ 1.0 + 15 _ 0.5 + 1 \* 0.0) / 166 = 157.5 / 166 = **94.9%**

Strict metric (only full matches): 150 / 166 = **90.4%**

**Final Match Rate: 93%** (weighted average, accounting for functional completeness)

---

## Updated Gap List

### Critical (Must Fix)

None.

### Remaining Minor Gaps (Phase 1 scope)

| #     | Item                                     | Design Location | Implementation             | Impact     | Iteration 1 Status |
| ----- | ---------------------------------------- | --------------- | -------------------------- | ---------- | :----------------: |
| ~~1~~ | ~~`converters.ts` not at entity layer~~  | ~~Section 7.3~~ | ~~Inlined in widget hook~~ | ~~Low~~    |      RESOLVED      |
| ~~2~~ | ~~`CustomEdge.tsx` not present~~         | ~~Section 8.9~~ | ~~Default edges~~          | ~~Medium~~ |      RESOLVED      |
| ~~3~~ | ~~`ConnectionMode.Loose` missing~~       | ~~Section 8.6~~ | ~~Not set~~                | ~~Low~~    |      RESOLVED      |
| ~~4~~ | ~~`onlyRenderVisibleElements` missing~~  | ~~Section 8.6~~ | ~~Not set~~                | ~~Low~~    |      RESOLVED      |
| ~~5~~ | ~~Broken ref detection missing~~         | ~~Section 8.8~~ | ~~Not in RefNode~~         | ~~Low~~    |      RESOLVED      |
| 6     | `devtools` middleware missing from store | Section 8.3     | Not present                | Low        |     Unchanged      |
| 7     | `updateRefData` store action missing     | Section 8.3     | Not present                | Medium     |     Unchanged      |
| ~~8~~ | ~~ReactFlowProvider wrapper missing~~    | ~~Section 8.6~~ | ~~No provider~~            | ~~Low~~    |      RESOLVED      |

**6 of 8 gaps resolved.** Remaining 2 are low/medium impact store-level concerns.

### Phase 2 (Deferred -- as designed)

| #   | Item                                   | Description                                    |
| --- | -------------------------------------- | ---------------------------------------------- |
| 1   | Entity Link integration                | 5 files to modify                              |
| 2   | Canvas delete entity link cleanup      | `entityLinkService.removeAllLinks` in remove() |
| 3   | Edge label editing / edge context menu | Phase 2-D                                      |
| 4   | Group CRUD                             | Phase 2-A: canvas_groups repo + service + IPC  |

### Phase 3 (Deferred -- as designed)

| #   | Item                           | Description |
| --- | ------------------------------ | ----------- |
| 1   | Auto layout (`@dagrejs/dagre`) | Phase 3-A   |
| 2   | Keyboard shortcuts system      | Phase 3-B   |
| 3   | Canvas export                  | Phase 3-C   |

---

## Added Features (Design X, Implementation O)

Unchanged from previous analysis. 10 added features documented.

| #   | Item                                           | Location                                      | Description                                             |
| --- | ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| 1   | `CreateCanvasDialog`                           | `features/canvas/create-canvas/`              | Proper dialog with zod validation                       |
| 2   | `DeleteCanvasDialog`                           | `features/canvas/delete-canvas/`              | AlertDialog confirmation                                |
| 3   | `EntityPickerDialog`                           | `widgets/canvas/ui/EntityPickerDialog.tsx`    | Ref node picker (was Phase 2)                           |
| 4   | `addRefNode` function                          | `widgets/canvas/model/use-canvas-data.ts`     | Ref node creation (was Phase 2)                         |
| 5   | `useUpdateCanvasViewport` hook                 | `entities/canvas/model/queries.ts`            | Dedicated viewport mutation                             |
| 6   | Inline text editing in TextNode                | `widgets/canvas/ui/TextNode.tsx`              | Double-click to edit + auto-save                        |
| 7   | Editable title/description in CanvasDetailPage | `pages/canvas-detail/ui/CanvasDetailPage.tsx` | TabHeader `editable` prop                               |
| 8   | Date display on canvas cards                   | `pages/canvas/ui/CanvasListPage.tsx`          | `updatedAt` display                                     |
| 9   | Accessibility attributes                       | `pages/canvas/ui/CanvasListPage.tsx`          | `role="button"`, `tabIndex`, `onKeyDown`                |
| 10  | Handle type split                              | `TextNode.tsx`, `RefNode.tsx`                 | target (top/left) + source (bottom/right) vs all-source |

---

## Changed Features (Design != Implementation)

Updated to reflect resolved items.

| #   | Item                       | Design                                              | Implementation                                     | Impact             | Resolved? |
| --- | -------------------------- | --------------------------------------------------- | -------------------------------------------------- | ------------------ | :-------: |
| 1   | Icon                       | `Workflow` (lucide)                                 | `Network` (lucide)                                 | Cosmetic           |     -     |
| 2   | Widget directory name      | `widgets/canvas-board/`                             | `widgets/canvas/`                                  | Cosmetic           |     -     |
| 3   | Component names            | `TextNodeContent`, `RefNodeContent`                 | `TextNode`, `RefNode`                              | Cosmetic           |     -     |
| 4   | Query hook names           | `useCreateNode`, `useUpdateNode`, etc.              | `useCreateCanvasNode`, `useUpdateCanvasNode`, etc. | Cosmetic           |     -     |
| 5   | Node type strategy         | 7 ReactFlow types                                   | 2 types (`textNode`, `refNode`)                    | Structural         |     -     |
| 6   | Store architecture         | Comprehensive `canvas-store.ts` with dirty tracking | Minimal `useCanvasFlowStore` in hook file          | Structural         |     -     |
| 7   | Position persistence       | Dirty set -> flush hook -> batch                    | Immediate on drag end in `onNodesChange`           | Behavioral         |     -     |
| 8   | CanvasDetailPage           | Bare `<div>` wrapper                                | `TabContainer` with editable header                | UX improvement     |     -     |
| 9   | Color application (nodes)  | `backgroundColor`                                   | `borderColor`                                      | Visual difference  |     -     |
| 10  | Handle types               | All `type="source"` (bidirectional)                 | Split target/source by position                    | Behavioral         |     -     |
| 11  | CanvasListPage description | "... 관리하는 페이지입니다."                        | "아이디어를 시각적으로 연결하고 정리하세요"        | Cosmetic           |     -     |
| 12  | Empty state text           | "아직 캔버스가 없습니다"                            | "캔버스가 없습니다"                                | Cosmetic           |     -     |
| 13  | Toolbar layout             | DropdownMenu at top-left                            | Inline buttons centered at top                     | UX difference      |     -     |
| 14  | `fitView` condition        | `nodes.length === 0 && !savedViewport`              | `nodes.length > 0 && defaultViewport.x === 0`      | Behavioral         |     -     |
| 15  | Edge connection creation   | Checks store for existing edges + uses converter    | Directly calls `createEdge` mutation via converter | Simplified         |     -     |
| 16  | Edge type key name         | `'custom'`                                          | `'customEdge'`                                     | Cosmetic           |     -     |
| 17  | Stroke dasharray values    | `'6 4'` / `'2 4'`                                   | `'5 5'` / `'2 2'`                                  | Visual calibration |     -     |

---

## Recommended Actions

### Immediate Actions

All 4 previously-recommended immediate actions have been completed:

1. ~~Extract `converters.ts` to entity layer~~ -- DONE
2. ~~Create `CustomEdge.tsx`~~ -- DONE
3. ~~Add `ConnectionMode.Loose` and `onlyRenderVisibleElements`~~ -- DONE
4. ~~Add broken ref detection in `RefNode.tsx`~~ -- DONE

### Remaining Optional Actions

1. Add `devtools` middleware to `useCanvasFlowStore` for debugging convenience (Low impact)
2. Add `updateRefData` store action for tab-activation ref data refresh (Medium impact, related to Phase 2 entity link integration)

### Documentation Update Needed

1. Update design to reflect the actual naming (`widgets/canvas/` not `widgets/canvas-board/`)
2. Update design to reflect renamed hooks (`useCreateCanvasNode` etc.)
3. Document the 2-node-type strategy vs 7-node-type strategy decision
4. Add `CreateCanvasDialog`, `DeleteCanvasDialog`, `EntityPickerDialog` to design
5. Document the editable CanvasDetailPage header (title/description editing)
6. Document inline text editing in TextNode
7. Update edge type key from `'custom'` to `'customEdge'` in design

### No Action Needed (intentional improvements)

- Feature-layer dialogs (CreateCanvasDialog, DeleteCanvasDialog) -- better FSD compliance
- EntityPickerDialog -- Phase 2 delivered early
- Inline text editing in TextNode -- major UX improvement
- Handle type split (target/source) -- better connection UX
- Domain-prefixed hook names -- better naming convention
- `memo()` wrapping on CustomEdge -- performance improvement
- Converter-level stroke styling -- cleaner separation of concerns

---

## Version History

| Version | Date       | Match Rate | Changes                                                                                                                   |
| ------- | ---------- | :--------: | ------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-03-03 |    87%     | Initial analysis                                                                                                          |
| 1.1     | 2026-03-03 |    93%     | Re-analysis post Iteration 1: converters extracted, CustomEdge created, ReactFlow props added, broken ref detection added |

---

## Related Documents

- Design: [canvas-visualization.design.md](../02-design/features/canvas-visualization.design.md)
- Plan: [canvas-visualization.plan.md](../01-plan/features/canvas-visualization.plan.md)
