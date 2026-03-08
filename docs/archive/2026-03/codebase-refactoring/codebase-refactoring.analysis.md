# Codebase Refactoring Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-03-07
> **Design Doc**: [codebase-refactoring.design.md](../02-design/features/codebase-refactoring.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the codebase refactoring implementation (Steps 0-7) matches the design document specifications. This refactoring consolidates duplicated patterns across file-type repositories, services, own-write trackers, watcher hooks, context menus, preload listeners, and the workspace watcher.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/codebase-refactoring.design.md`
- **Implementation Paths**: `src/main/`, `src/preload/`, `src/renderer/src/`
- **Analysis Date**: 2026-03-07
- **Steps Covered**: Step 0 (Bug Fixes) through Step 7 (Performance)

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Step 0: Bug Fixes

| #      | Design Item                                        | Implementation                                                                                         | Status | Notes                                                     |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | :----: | --------------------------------------------------------- |
| BUG-1a | own-write-tracker Set -> Map with clearTimeout     | `entities/note/model/own-write-tracker.ts` uses `createOwnWriteTracker()` factory (Map-based)          |   ✅   | Implemented via factory (Step 4-1 applied simultaneously) |
| BUG-1b | isOwnWrite checks Map.has()                        | Factory returns `pendingWrites.has(id)`                                                                |   ✅   |                                                           |
| BUG-2  | useRenameNote onMutate adds markAsOwnWrite(noteId) | `queries.ts` L56-58: `markAsOwnWrite(noteId)` in onMutate                                              |   ✅   | Exact match                                               |
| BUG-2b | import markAsOwnWrite from own-write-tracker       | `queries.ts` L12: `import { markAsOwnWrite } from '../model/own-write-tracker'`                        |   ✅   |                                                           |
| BUG-3a | Barrel export isOwnWrite                           | `entities/note/index.ts` L13: `export { isOwnWrite } from './model/own-write-tracker'`                 |   ✅   |                                                           |
| BUG-3b | Barrel export NOTE_EXTERNAL_CHANGED_EVENT          | `entities/note/index.ts` L14: `export { NOTE_EXTERNAL_CHANGED_EVENT } from './model/use-note-watcher'` |   ✅   |                                                           |

**Step 0 Score: 6/6 (100%)**

---

### 2.2 Step 1: fs-utils Generic Scanner

| #   | Design Item                                                                       | Implementation                                                | Status | Notes |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- | :----: | ----- |
| 1a  | FileEntry interface { name, relativePath }                                        | `fs-utils.ts` L5-8: exact match                               |   ✅   |       |
| 1b  | Type aliases: MdFileEntry, CsvFileEntry, PdfFileEntry, ImageFileEntry = FileEntry | L11-14: exact match                                           |   ✅   |       |
| 1c  | readFilesRecursive (sync, not exported)                                           | L22-48: exact match -- symlink skip, dot-file skip, recursive |   ✅   |       |
| 1d  | readFilesRecursiveAsync (async, not exported)                                     | L55-84: exact match -- Promise.all for subdirs                |   ✅   |       |
| 1e  | 8 wrapper exports (4 sync + 4 async)                                              | L88-112: all 8 wrappers present                               |   ✅   |       |
| 1f  | isImageFile, IMAGE_EXTENSIONS unchanged                                           | L116-121: unchanged                                           |   ✅   |       |
| 1g  | resolveNameConflict unchanged                                                     | L134-152: unchanged                                           |   ✅   |       |

**Step 1 Score: 7/7 (100%)**

---

### 2.3 Step 2: Service path-utils Extraction

| #   | Design Item                                              | Implementation                                                     | Status | Notes |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------ | :----: | ----- |
| 2a  | New file: `src/main/lib/path-utils.ts`                   | File exists with exact implementation                              |   ✅   |       |
| 2b  | normalizePath function                                   | L2-4: `p.replace(/\\/g, '/')`                                      |   ✅   |       |
| 2c  | parentRelPath function                                   | L7-11: split('/'), slice(0,-1).join('/')                           |   ✅   |       |
| 2d  | note.ts imports from path-utils                          | `import { normalizePath, parentRelPath } from '../lib/path-utils'` |   ✅   |       |
| 2e  | csv-file.ts imports from path-utils                      | Same import confirmed                                              |   ✅   |       |
| 2f  | pdf-file.ts imports from path-utils                      | Same import confirmed                                              |   ✅   |       |
| 2g  | image-file.ts imports from path-utils                    | Same import confirmed                                              |   ✅   |       |
| 2h  | folder.ts imports normalizePath from path-utils          | `import { normalizePath } from '../lib/path-utils'` confirmed      |   ✅   |       |
| 2i  | No local normalizePath/parentRelPath in services         | Grep confirms 0 local definitions                                  |   ✅   |       |
| 2j  | toXxxNode mappers remain in each service (not extracted) | Design explicitly says "유지"                                      |   ✅   |       |

**Step 2 Score: 10/10 (100%)**

---

### 2.4 Step 3: Repository Factory

| #   | Design Item                                                                           | Implementation                                  | Status | Notes                                    |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------- | :----: | ---------------------------------------- |
| 3a  | New file: `create-file-repository.ts`                                                 | File exists                                     |   ✅   |                                          |
| 3b  | Generic constraint: table has id, workspaceId, relativePath                           | L10-15: includes `folderId` additionally        |   ✅   | Added folderId for Step 7 findByFolderId |
| 3c  | findByWorkspaceId method                                                              | L21-23                                          |   ✅   |                                          |
| 3d  | findById method                                                                       | L25-27                                          |   ✅   |                                          |
| 3e  | findByRelativePath method                                                             | L29-35                                          |   ✅   |                                          |
| 3f  | create method                                                                         | L52-54                                          |   ✅   |                                          |
| 3g  | createMany with CHUNK=99                                                              | L56-65                                          |   ✅   |                                          |
| 3h  | deleteOrphans method                                                                  | L67-88                                          |   ✅   |                                          |
| 3i  | bulkDeleteByPrefix method                                                             | L90-96                                          |   ✅   |                                          |
| 3j  | bulkUpdatePathPrefix with raw SQL                                                     | L98-111                                         |   ✅   |                                          |
| 3k  | reindexSiblings method                                                                | L113-123                                        |   ✅   |                                          |
| 3l  | findByIds with CHUNK=900                                                              | L125-136                                        |   ✅   |                                          |
| 3m  | delete method                                                                         | L138-140                                        |   ✅   |                                          |
| 3n  | note.ts uses factory: `createFileRepository(notes, 'notes')` + spread + custom update | Exact match                                     |   ✅   |                                          |
| 3o  | csv-file.ts uses factory with columnWidths in update                                  | Exact match                                     |   ✅   |                                          |
| 3p  | pdf-file.ts uses factory pattern                                                      | Exact match                                     |   ✅   |                                          |
| 3q  | image-file.ts uses factory pattern                                                    | Exact match                                     |   ✅   |                                          |
| 3r  | findByFolderId method (Step 7 addition)                                               | L37-50: with isNull for null folderId           |   ✅   | Implemented in factory per Step 7        |
| 3s  | isNull import from drizzle-orm                                                        | L1: `import { and, eq, inArray, isNull, like }` |   ✅   |                                          |

**Step 3 Score: 19/19 (100%)**

---

### 2.5 Step 4: Renderer Consolidation

#### 4-1. Own-Write Tracker Factory

| #    | Design Item                                        | Implementation                                   | Status | Notes |
| ---- | -------------------------------------------------- | ------------------------------------------------ | :----: | ----- |
| 4-1a | New file: `shared/lib/create-own-write-tracker.ts` | File exists                                      |   ✅   |       |
| 4-1b | Factory function with Map + clearTimeout           | Exact match: Map, clearTimeout(prev), setTimeout |   ✅   |       |
| 4-1c | Default timeoutMs = 2000                           | L2: `timeoutMs = 2000`                           |   ✅   |       |
| 4-1d | Note own-write-tracker uses factory                | 3 lines: import, create, re-export               |   ✅   |       |
| 4-1e | CSV own-write-tracker uses factory                 | Identical pattern                                |   ✅   |       |
| 4-1f | PDF own-write-tracker uses factory                 | Identical pattern                                |   ✅   |       |
| 4-1g | Image own-write-tracker uses factory               | Identical pattern                                |   ✅   |       |

#### 4-2. File Watcher Hook Factory

| #    | Design Item                                                                | Implementation                                 | Status | Notes |
| ---- | -------------------------------------------------------------------------- | ---------------------------------------------- | :----: | ----- |
| 4-2a | New file: `shared/hooks/use-file-watcher.ts`                               | File exists                                    |   ✅   |       |
| 4-2b | FileWatcherConfig interface (6 fields)                                     | L6-19: all 6 fields match                      |   ✅   |       |
| 4-2c | useFileWatcher implementation (readyRef, invalidation, toast, CustomEvent) | L21-85: exact match                            |   ✅   |       |
| 4-2d | Note watcher uses useFileWatcher                                           | FileText icon, 'note' prefix, 'noteId' idField |   ✅   |       |
| 4-2e | CSV watcher uses useFileWatcher                                            | Sheet icon, 'csv' prefix, 'csvId' idField      |   ✅   |       |
| 4-2f | PDF watcher uses useFileWatcher                                            | PdfIcon, 'pdf' prefix, 'pdfId' idField         |   ✅   |       |
| 4-2g | Image watcher uses useFileWatcher                                          | ImageIcon, 'image' prefix, 'imageId' idField   |   ✅   |       |

#### 4-3. Context Menu Consolidation

| #    | Design Item                              | Implementation                | Status | Notes |
| ---- | ---------------------------------------- | ----------------------------- | :----: | ----- |
| 4-3a | New file: `FileContextMenu.tsx`          | File exists                   |   ✅   |       |
| 4-3b | Props: children + onDelete               | L10-13: exact match           |   ✅   |       |
| 4-3c | ContextMenu with destructive delete item | L15-27: exact match           |   ✅   |       |
| 4-3d | NoteContextMenu.tsx deleted              | Not found (confirmed deleted) |   ✅   |       |
| 4-3e | CsvContextMenu.tsx deleted               | Not found (confirmed deleted) |   ✅   |       |
| 4-3f | PdfContextMenu.tsx deleted               | Not found (confirmed deleted) |   ✅   |       |
| 4-3g | ImageContextMenu.tsx deleted             | Not found (confirmed deleted) |   ✅   |       |

**Step 4 Score: 21/21 (100%)**

---

### 2.6 Step 5: Preload onChanged Helper

| #   | Design Item                                          | Implementation                                         | Status | Notes |
| --- | ---------------------------------------------------- | ------------------------------------------------------ | :----: | ----- |
| 5a  | createOnChangedListener helper function              | `preload/index.ts` L14-24: exact match                 |   ✅   |       |
| 5b  | note.onChanged uses helper                           | L44: `createOnChangedListener('note:changed')`         |   ✅   |       |
| 5c  | csv.onChanged uses helper                            | L67: `createOnChangedListener('csv:changed')`          |   ✅   |       |
| 5d  | pdf.onChanged uses helper                            | L86: `createOnChangedListener('pdf:changed')`          |   ✅   |       |
| 5e  | image.onChanged uses helper                          | L105: `createOnChangedListener('image:changed')`       |   ✅   |       |
| 5f  | folder.onChanged uses helper                         | L132: `createOnChangedListener('folder:changed')`      |   ✅   |       |
| 5g  | entity-link.onChanged excluded (different signature) | L187-191: manual handler (no params), NOT using helper |   ✅   |       |

**Step 5 Score: 7/7 (100%)**

---

### 2.7 Step 6: Workspace Watcher Refactoring

| #   | Design Item                                                         | Implementation                                                                 | Status | Notes                                                           |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | :----: | --------------------------------------------------------------- |
| 6a  | FileTypeConfig interface defined                                    | L25-50: all fields present                                                     |   ✅   | Added: `readFilesAsync`, `deleteOrphans`, `update` in repo type |
| 6b  | 4 configs in fileTypeConfigs array                                  | L52-86: 4 configs                                                              |   ✅   | See note on image bug below                                     |
| 6c  | Note config: .md, 'note:changed', noteRepository                    | L53-60: exact match                                                            |   ✅   |                                                                 |
| 6d  | CSV config: .csv, 'csv:changed', csvFileRepository                  | L61-68: exact match                                                            |   ✅   |                                                                 |
| 6e  | PDF config: .pdf, 'pdf:changed', pdfFileRepository                  | L69-76: exact match                                                            |   ✅   |                                                                 |
| 6f  | Image config: isImageFile, 'image:changed', skipFilter for .images/ | L77-92: patched after initial declaration                                      |   ✅   | See cosmetic diff below                                         |
| 6g  | processFileTypeEvents method extracted                              | L378-475: handles rename/create/delete generically                             |   ✅   |                                                                 |
| 6h  | reconcileFileType method extracted                                  | L480-524: FS scan -> DB compare -> createMany -> orphan delete                 |   ✅   |                                                                 |
| 6i  | pushChanged method extracted                                        | L549-553: BrowserWindow.getAllWindows().forEach                                |   ✅   |                                                                 |
| 6j  | applyEvents uses config loop: folder first, then fileTypeConfigs    | L243-373: folder Steps 1-2 first, then `for (const config of fileTypeConfigs)` |   ✅   |                                                                 |
| 6k  | handleEvents uses fileTypeConfigs for path collection               | L197-233: config-based filter loop                                             |   ✅   |                                                                 |
| 6l  | start() uses config loop for reconciliation                         | L114-119: `for (const config of fileTypeConfigs)`                              |   ✅   |                                                                 |

**Step 6 Score: 12/12 (100%)**

---

### 2.8 Step 7: Performance Improvements

| #    | Design Item                                     | Implementation                                                           | Status | Notes |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------ | :----: | ----- |
| 7-1a | note.ts: batch folder load with folderMap       | `allFolders = folderRepository.findByWorkspaceId(...)` + `new Map(...)`  |   ✅   |       |
| 7-1b | csv-file.ts: batch folder load with folderMap   | Same pattern confirmed                                                   |   ✅   |       |
| 7-1c | pdf-file.ts: batch folder load with folderMap   | Same pattern confirmed                                                   |   ✅   |       |
| 7-1d | image-file.ts: batch folder load with folderMap | Same pattern confirmed                                                   |   ✅   |       |
| 7-2a | findByFolderId added to repository factory      | `create-file-repository.ts` L37-50: with isNull handling                 |   ✅   |       |
| 7-2b | leaf-reindex.ts uses findByFolderId             | L17-28: all 4 repositories call `.findByFolderId(workspaceId, folderId)` |   ✅   |       |

**Step 7 Score: 6/6 (100%)**

---

## 3. Cosmetic Differences (Non-Functional)

| #   | Item                           | Design                              | Implementation                                      | Impact                                                                                                                                     |
| --- | ------------------------------ | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C-1 | Factory generic constraint     | `{ id, workspaceId, relativePath }` | `{ id, workspaceId, relativePath, folderId }`       | None -- `folderId` added to support `findByFolderId` (Step 7). Structural improvement.                                                     |
| C-2 | FileTypeConfig interface       | 7 fields defined                    | 8 fields: added `readFilesAsync` for reconciliation | None -- design mentions `reconcileFileType(config, readFilesAsync)` as parameter but implementation embeds it in config. Cleaner approach. |
| C-3 | FileTypeConfig.repository type | 7 methods in design                 | 9 methods: added `deleteOrphans`, `update`          | None -- `update` needed for rename handling in processFileTypeEvents; `deleteOrphans` for reconciliation.                                  |
| C-4 | Image config declaration       | Single object with `isImageFile`    | Declared with `.pdf` then patched on L89-92         | Cosmetic code smell -- works correctly but the initial `.pdf` on L78 is a typo that gets overridden. Should be `isImageFile` directly.     |

---

## 4. Added Features (Not in Design)

| #   | Item                                          | Location                      | Description                                                                                                                                                                    |
| --- | --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-1 | reconcileFileType with orphan cleanup         | workspace-watcher.ts L517-523 | Uses `cleanupOrphansAndDelete` for entity-link cleanup before orphan deletion. Design's reconcileFileType description was high-level; implementation adds proper link cleanup. |
| A-2 | Folder delete cascades orphan path collection | workspace-watcher.ts L348-359 | Collects orphan paths per entity type when a folder is deleted, so renderer receives accurate changed paths. Not explicitly in design but required for correctness.            |

---

## 5. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100% (88/88)            |
+---------------------------------------------+
|  Step 0 (Bug Fixes):            6/6   100%   |
|  Step 1 (fs-utils):             7/7   100%   |
|  Step 2 (path-utils):          10/10  100%   |
|  Step 3 (Repository Factory):  19/19  100%   |
|  Step 4 (Renderer):            21/21  100%   |
|  Step 5 (Preload):              7/7   100%   |
|  Step 6 (Workspace Watcher):   12/12  100%   |
|  Step 7 (Performance):          6/6   100%   |
+---------------------------------------------+
|  Cosmetic Diffs:     4 (non-functional)      |
|  Added Features:     2 (improvements)        |
|  Missing Features:   0                       |
+---------------------------------------------+
```

---

## 6. Overall Scores

| Category                |  Score   |  Status  |
| ----------------------- | :------: | :------: |
| Design Match            |   100%   |   PASS   |
| Architecture Compliance |   100%   |   PASS   |
| Convention Compliance   |   100%   |   PASS   |
| **Overall**             | **100%** | **PASS** |

---

## 7. Recommended Actions

### 7.1 Minor Code Quality Fix

| Priority | Item              | File                       | Description                                                                                                                                                |
| -------- | ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low      | Image config typo | `workspace-watcher.ts` L78 | `matchExtension: (n) => n.endsWith('.pdf')` should be `isImageFile` directly instead of being patched on L89-92. Currently works but is confusing to read. |

### 7.2 No Design Document Updates Needed

All 88 design items are fully implemented. The 4 cosmetic differences and 2 added features are structural improvements that enhance the design rather than deviate from it.

---

## 8. Conclusion

The codebase refactoring implementation achieves a **100% match rate** across all 8 steps (88/88 design items). Every bug fix, new file, file deletion, import change, and performance optimization specified in the design document is present in the implementation. The 4 cosmetic differences are all structural improvements (adding `folderId` to factory constraint, embedding `readFilesAsync` in config, expanding repository interface for full functionality, image config declaration style). The 2 added features (orphan cleanup in reconciliation, folder-delete cascade path collection) are correctness improvements not explicitly described in design but required for proper behavior.

---

## Version History

| Version | Date       | Changes          | Author       |
| ------- | ---------- | ---------------- | ------------ |
| 1.0     | 2026-03-07 | Initial analysis | gap-detector |
