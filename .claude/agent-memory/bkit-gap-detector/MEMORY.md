# Gap Detector Memory

## Rally Project Structure

- Main process: `src/main/` (repositories/, services/, ipc/, db/schema/, lib/)
- Preload: `src/preload/` (index.ts runtime, index.d.ts types)
- Renderer: `src/renderer/src/` (FSD: entities/, features/, pages/, shared/)
- File naming: repositories and services use `domain.ts` not `domain.repository.ts`

## Previous Analyses

- **note** (2026-02-26): 93% match rate. Key gaps: NoteContextMenu missing onRename (tree-level rename). Key improvements: FSD extraction of features/note/edit-note, granular changedRelPaths in watcher, useNoteExternalSync for editor remount.
- **note-test** (2026-02-26): 100% match rate (88/88 cases). All 6 test files perfectly match plan. No gaps, no additions, no changes.

## Analysis Patterns

- Design docs provide exact code snippets; compare line-by-line for precise matching
- Implementation often improves on design (FSD extraction, caching, granular events)
- Missing items tend to be UX shortcuts, not core functionality
- Check barrel exports for FSD compliance (bypass = minor violation)
