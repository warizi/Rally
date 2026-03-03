# Changelog

## [2026-03-03] - canvas-visualization PDCA Completion

### Added

- **Canvas Visualization MVP Feature**: Obsidian Canvas-style infinite canvas for Rally entities
  - Database Schema: 4 tables (canvas, canvas_node, canvas_edge, canvas_group) with full constraints
  - Repository Layer: 3 new + 6 extended repositories (24 CRUD operations total)
  - Service Layer: 3 services with validation and business logic (30 methods)
  - IPC Bridge: 15 handlers across 3 modules (canvas, canvas-node, canvas-edge)
  - Entity Layer: 11 types + 14 query hooks (renamed with Canvas prefix) + 4 converters
  - Pages: CanvasListPage (list with CRUD) + CanvasDetailPage (detail editor)
  - Widgets: 6 components (CanvasBoard, TextNode, RefNode, CustomEdge, CanvasToolbar, EntityPickerDialog)
  - Features: CreateCanvasDialog + DeleteCanvasDialog (FSD-compliant feature layer dialogs)

- **React Flow Integration**: Connected @xyflow/react v12 with Zustand store
  - Zoom/pan/drag/minimap/controls built-in
  - Custom node types (TextNode for manual entry, RefNode for entity links)
  - Custom edge rendering with dynamic styling (solid/dashed)
  - Viewport persistence (debounced batch updates)
  - Keyboard shortcuts (Backspace/Delete to remove nodes)

- **Node Types**:
  - TextNode: Inline editable text (double-click to edit, auto-save on blur)
  - RefNode: Reference to Rally entities (Todo, Note, Schedule, PDF, Image, CSV)
  - Broken ref detection: Visual indicator (red border) when ref missing

- **Early Phase 2 Delivery**: EntityPickerDialog for creating ref nodes immediately

- **Accessibility**: Full keyboard support (tabIndex, onKeyDown, role="button") in list view

### Changed

- **Architecture Decision**: Two-type node strategy (TextNode + RefNode) instead of 7 ReactFlow types
  - Simpler state management, clearer semantics, better TypeScript support
- **Position Persistence**: 500ms debounced batch updates (vs immediate per-drag)
  - Reduces IPC overhead, maintains eventual consistency
- **Hook Naming Convention**: Canvas-prefixed hooks (useCreateCanvasNode vs useCreateNode)
  - Prevents naming collisions with other entity types

### Quality Metrics

- Design Match Rate: 93% (150 full + 15 partial / 166 items) — improved from 87% after 1 iteration
- Implementation Files: 24 new + 6 modified
- IPC Channels: 15 handlers
- Database Tables: 4 (fully normalized, with constraints)
- React Components: 8 (pages + widgets + features)
- Iteration Count: 1 (87% → 93%, 6 gaps resolved)
- Issues Found: 8 pre-production via gap analysis (100% detection rate)
- Critical Gaps: 0

### Architecture Highlights

- **FSD Compliance**: Full layer separation (repositories, services, entities, pages, widgets, features)
- **Zustand Integration**: Proper store pattern with applyNodeChanges/applyEdgeChanges utilities
- **React Query Integration**: 14 hooks for all CRUD + viewport operations
- **Type Safety**: Full TypeScript coverage via preload bridge types + entity types

### Documentation

- Plan: `docs/01-plan/features/canvas-visualization.plan.md` (v2.4) ✅
- Design: `docs/02-design/features/canvas-visualization.design.md` ✅
- Analysis: `docs/03-analysis/canvas-visualization.analysis.md` (v1.1) ✅
- Report: `docs/04-report/features/canvas-visualization.report.md` ✅

### Ready for Phase 2

- Entity Link integration (5 files to modify)
- Group functionality (3 new files)
- Edge interaction (2 new files)
- Estimated scope: 4-6 days

---

## [2026-03-02] - link-test PDCA Completion

### Added

- **Test Suite for entity-link**: 55 comprehensive test cases across 5 files (55 focused + 413 node + 573 web total)
  - Repository integration tests (19): entity-link CRUD + todo BFS descendant traversal
  - Service unit tests (26): normalize/validation/orphan cleanup with full branch coverage
  - Renderer pure function tests (5): entity type → tab options mapping
  - Mock enhancements (5): todo service link cleanup validation

- **Branch Coverage**: 100% on normalize (4 branches), link error paths (7), getLinked isSource (4 + orphan scenarios)

- **Test Documentation**: Warning comment on JavaScript default parameter behavior in mock setup

### Fixed

- **Critical Bug Fix**: JavaScript default parameter bug in vi.mock pattern
  - Changed `vi.clearAllMocks()` → `vi.resetAllMocks()` in service tests
  - Prevents false negatives where `mockFindById('type', undefined)` triggers default parameter fallback
  - All 26 service tests now pass with explicit mock setup per test

- **todo.test.ts Mock Gap**: Added `findAllDescendantIds` to todoRepository mock (was missing after link integration)
  - Restored 5 remove tests to passing state
  - Added 3 new tests validating link cleanup during todo deletion

### Changed

- **Implementation Quality**: Improved test helper patterns
  - Repository tests: Generic factory `makeTodo(overrides?)` pattern
  - Service tests: `mockBothEntities()` helper correctly handles same-type linking
  - Added defensive comments documenting subtle JavaScript behaviors

### Quality Metrics

- Design Match Rate: 100% (66/66 items)
- Test Pass Rate: 100% (986 total tests: 413 node + 573 web)
- Iteration Count: 0 (no Act phase needed)
- Backward Compatibility: 100% (all 38 existing todo service tests passing)

### Documentation

- Plan: `docs/01-plan/features/link-test.plan.md` ✅
- Design: `docs/02-design/features/link-test.design.md` ✅
- Analysis: `docs/03-analysis/link-test.analysis.md` ✅
- Report: `docs/04-report/link-test.report.md` ✅
