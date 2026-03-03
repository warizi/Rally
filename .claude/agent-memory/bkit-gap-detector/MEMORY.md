# Gap Detector Memory

## Rally Project Structure

- Main process: `src/main/` (repositories/, services/, ipc/, db/schema/, lib/)
- Preload: `src/preload/` (index.ts runtime, index.d.ts types)
- Renderer: `src/renderer/src/` (FSD: entities/, features/, pages/, shared/)
- File naming: repositories and services use `domain.ts` not `domain.repository.ts`

## Previous Analyses

- **note** (2026-02-26): 93% match rate. Key gaps: NoteContextMenu missing onRename (tree-level rename). Key improvements: FSD extraction of features/note/edit-note, granular changedRelPaths in watcher, useNoteExternalSync for editor remount.
- **note-test** (2026-02-26): 100% match rate (88/88 cases). All 6 test files perfectly match plan. No gaps, no additions, no changes.
- **large-workspace-freeze-v2** (2026-02-28): 100% match rate (120/120 design items). 7 Fixes across 6 files match exactly. 2 Added fixes not in design: Fix 8 (buildTree O(n) optimization in folder.ts), Fix 9 (useNoteExternalSync race condition fix in renderer).
- **csv-test** (2026-03-01): 100% match rate (55/55 cases). 2 test files (repository 21 cases, service 34 cases) perfectly match plan. No gaps, no additions, no changes.
- **csv-renderer-refactor** (2026-03-01): 100% match rate (77/78 items). 4 hooks + types extracted from 620-line CsvTable.tsx. All 12 functionalities preserved. Clipboard/delete duplication eliminated. Only deviation: line count estimates (325 vs ~250 for CsvTable, 394 vs ~280 for hooks) -- structural boilerplate, not functional gaps.
- **pdf-test** (2026-03-01): 100% match rate (47/47 cases). 2 test files (repository 21 cases, service 26 cases) perfectly match design. No gaps, no additions. One cosmetic wording diff: createMany case says "중복 relativePath" instead of "중복 id" -- more precise, not a functional gap.
- **calendar-refactor** (2026-03-02): 100% match rate (131/131 items). 11 new files + 4 modified files across 4 phases. 11 cosmetic diffs (type names, variable names, code reuse improvements). Key: assignLanes generic more constrained than design, computeWeekBars inlines lane logic instead of calling assignLanes, calendar-utils barrel uses named exports instead of wildcard. All functional -- zero gaps.
- **schedule-test** (2026-03-02): 100% match rate (162/162 cases). 10 test files + helpers.ts across 11 modules. 27/27 tagged edge cases ([G-1]~[X-2]) all covered. 3 added tests (layout tiebreaker, lane reuse, DnD DOM activeSize). 4 cosmetic diffs (G-2 date choice, makeWeek inlined, layout helpers localized, removeEventListener behavioral vs spy). All test strategies match: vi.useFakeTimers, DnD plain-object mocking, PointerEvent simulation.
- **link-test** (2026-03-02): 100% match rate (66/66 items). 5 test files across 3 layers (repository/service/renderer). 55 tests total in design scope. Key deviation: design bug fix -- vi.clearAllMocks changed to vi.resetAllMocks to fix JS default parameter behavior in mockFindById('type', undefined). 4 cosmetic diffs (WS_ID value, makeTodo signature, file integration, warning comment). All 413 node + 573 web tests passing.
- **image-viewer-test** (2026-03-02): 100% match rate (67/67 cases). 5 test files across 3 layers (repository 21, service 29, renderer 17: own-write-tracker 5 + queries 11 + to-tab-options 1). No gaps, no additions, no changes. 5 cosmetic diffs (unique ID naming, wording). Key patterns: remove call-order verification with entityLinkService.removeAllLinks, move folder->root prefix removal, rename subfolder path preservation.
- **canvas-visualization** (2026-03-03): 87% -> 93% match rate after Iteration 1 (166 items). Backend layers 100%. Iteration 1 fixed 6/8 gaps: converters.ts extracted to entity layer, CustomEdge.tsx created with BaseEdge/getBezierPath/EdgeLabelRenderer/memo, ReactFlowProvider added, ConnectionMode.Loose + onlyRenderVisibleElements + defaultEdgeOptions added, broken ref detection added to RefNode. Remaining 2 minor gaps: devtools middleware, updateRefData store action. 10 added features unchanged. Key cosmetic diffs: edge type key 'customEdge' vs 'custom', dasharray values '5 5'/'2 2' vs '6 4'/'2 4'.
- **canvas-refactor-v4** (2026-03-03): 94% match rate (52/62 items). Phases 1-5 functional code: 28/28 = 100%. Phase 6 tests: 24/34 (2 test files missing: use-canvas-store.test.ts, use-canvas-hydration.test.ts). 6 added test cases. 4 cosmetic diffs (unused canvasId prop removed from CanvasBoardInner, streamlined imports). All 7 old code removal targets verified clean (as unknown as, REF_NODE_REGISTRY, ENTITY_TYPES, ref-node-registry.ts, local interfaces, index signatures).
- **canvas-test** (2026-03-03): 100% match rate (116/116 cases). 7 test files across 3 layers (repository 3: canvas 11, canvas-node 15, canvas-edge 8; service 3: canvas 18, canvas-node 23, canvas-edge 15; renderer 1: queries 26). No gaps, no additions, no changes, no cosmetic diffs. Key patterns: batchFetchRefs tests all 6 entity types (todo/note/schedule/csv/pdf/image), edge validation order (canvas->self-loop->fromNode->toNode->duplicate), directional duplicate check (A->B exists, B->A allowed). All 553 node + 646 web tests passing.
- **note-image** (2026-03-03): 100% match rate (47/47 design items). 9 files across 3 layers (main 4, preload 2, renderer 2) + 1 extra (note.ts cleanup). 3 intentional changes: Milkdown import paths `/kit/` subpath for Vite, manual DnD handler replacing ProseMirror handleDrop (Electron compat). 12 added items: image cleanup (extractImagePaths, deleteImage, cleanupRemovedImages, deleteAllImages), manual DnD infrastructure (saveDroppedFile, wrapperRef, useInstance, insertImageCommand, callCommand), note.ts writeContent/remove integration.
- **note-image-test** (2026-03-03): 100% match rate (36/36 cases). 2 test files: note-image.test.ts (32 cases across 7 describes: saveFromPath 6, saveFromBuffer 4, readImage 6, extractImagePaths 5, deleteImage 6, cleanupRemovedImages 3, deleteAllImages 2) + note.test.ts (4 added cases: writeContent image cleanup 2, remove image delete 2). 1 cosmetic diff: extractImagePaths title case -- design predicted `['.images/photo.png']` but regex actually returns `[]` due to `\)` anchor failing after title text. Implementation corrected the design bug.

## Analysis Patterns

- Design docs provide exact code snippets; compare line-by-line for precise matching
- Implementation often improves on design (FSD extraction, caching, granular events)
- Missing items tend to be UX shortcuts, not core functionality
- Check barrel exports for FSD compliance (bypass = minor violation)
