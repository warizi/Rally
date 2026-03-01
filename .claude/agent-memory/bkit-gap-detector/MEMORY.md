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

## Analysis Patterns

- Design docs provide exact code snippets; compare line-by-line for precise matching
- Implementation often improves on design (FSD extraction, caching, granular events)
- Missing items tend to be UX shortcuts, not core functionality
- Check barrel exports for FSD compliance (bypass = minor violation)
