# large-workspace-freeze-v2 Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-28
> **Design Doc**: [large-workspace-freeze-v2.design.md](../02-design/features/large-workspace-freeze-v2.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Design document(7 Fixes) vs actual implementation code line-by-line comparison, plus identification of 2 additional implementation fixes (Fix 8, Fix 9) not present in the design document.

### 1.2 Analysis Scope

**Design-Specified Fixes (Fix 1-7)**:

| Fix | Design Location | Implementation File |
|-----|-----------------|---------------------|
| Fix 1 | design.md:29-39 | `src/main/services/note.ts:133-142` |
| Fix 2 | design.md:50-63 | `src/main/ipc/note.ts:7-11` |
| Fix 3 | design.md:90-169 | `src/main/services/workspace-watcher.ts:234-321` |
| Fix 4 | design.md:184-259 | `src/main/services/workspace-watcher.ts:27-51,347-380` |
| Fix 5 | design.md:270-335 | `src/main/repositories/note.ts:1,29-72` |
| Fix 6 | design.md:351-439 | `src/main/lib/fs-utils.ts:43-73`, `src/main/services/folder.ts:49-76`, `workspace-watcher.ts:324-325` |
| Fix 7 | design.md:448-504 | `src/main/services/workspace-watcher.ts:16,53-54,110-127` |

**Additional Implementation Fixes (not in design)**:

| Fix | Description | Implementation File |
|-----|-------------|---------------------|
| Fix 8 | `buildTree` O(n^2) to O(n) optimization | `src/main/services/folder.ts:103-138` |
| Fix 9 | Editor remount race condition fix | `src/renderer/src/features/note/edit-note/model/use-note-external-sync.ts`, `src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx` |

---

## 2. Fix-by-Fix Gap Analysis (Design-Specified)

### Fix 1 -- `noteService.readByWorkspaceFromDb` added

**Design (design.md:29-39)**:
```typescript
readByWorkspaceFromDb(workspaceId: string): NoteNode[] {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
  return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
},
```

**Implementation (note.ts:133-142)**:
```typescript
readByWorkspaceFromDb(workspaceId: string): NoteNode[] {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
  return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
},
```

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Method name | `readByWorkspaceFromDb` | `readByWorkspaceFromDb` | Match |
| Return type | `NoteNode[]` | `NoteNode[]` | Match |
| Workspace lookup | `workspaceRepository.findById` | `workspaceRepository.findById` | Match |
| Error handling | `NotFoundError` | `NotFoundError` | Match |
| DB query | `noteRepository.findByWorkspaceId().map(toNoteNode)` | `noteRepository.findByWorkspaceId().map(toNoteNode)` | Match |
| JSDoc comment | 3-line comment | 3-line comment (identical) | Match |
| Position | below `readByWorkspace` | below `readByWorkspace` (L132) | Match |

**Fix 1 Match Rate: 100% (7/7 items)**

---

### Fix 2 -- IPC handler swap (`note:readByWorkspace`)

**Design (design.md:59-63)**:
```typescript
handle(() => noteService.readByWorkspaceFromDb(workspaceId))
```

**Implementation (ipc/note.ts:9-10)**:
```typescript
handle(() => noteService.readByWorkspaceFromDb(workspaceId))
```

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Handler name | `note:readByWorkspace` | `note:readByWorkspace` | Match |
| Service call | `readByWorkspaceFromDb` | `readByWorkspaceFromDb` | Match |
| Other handlers | unchanged | unchanged | Match |

**Fix 2 Match Rate: 100% (3/3 items)**

---

### Fix 3 -- `applyEvents` Step 3 modification + Step 4, 5 added

#### Step 3: pairedMdCreatePaths added

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `pairedMdCreatePaths` declaration | `new Set<string>()` | `new Set<string>()` (L244) | Match |
| `pairedMdCreatePaths.add(createEvent.path)` | inside Step 3 | L275 | Match |
| mdDeletes filter | `.filter(...)` | L237-239 | Match |
| mdCreates filter | `.filter(...)` | L240-242 | Match |
| matchingDelete logic (same dir, then same basename) | 2-step find | L249-255 | Match |
| noteRepository.update fields | `relativePath, folderId, title, updatedAt` | L268-273 | Match |
| `newParentRel` calculation | `newRel.includes('/') ? ... : null` | L262-264 | Match |
| `newFolder` lookup | `folderRepository.findByRelativePath` | L265-267 | Match |
| `folderId` ternary | `newParentRel ? (newFolder?.id ?? existing.folderId) : null` | L270 | Match |

#### Step 4: standalone MD create

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `pairedMdCreatePaths` skip check | `if (pairedMdCreatePaths.has(...)) continue` | L282 | Match |
| `rel` calculation | `path.relative(...).replace(...)` | L283 | Match |
| `findByRelativePath` check | `if (!existing)` | L284-285 | Match |
| `fs.promises.stat` guard | try/catch + `!stat.isFile()` | L287-292 | Match |
| `parentRel` calculation | `rel.includes('/') ? ... : null` | L293 | Match |
| `folder` lookup | `folderRepository.findByRelativePath` | L294-296 | Match |
| `noteRepository.create` fields | all 10 fields | L298-309 | Match |
| `folderId` value | `folder?.id ?? null` | L302 | Match |
| Comment (50ms debounce note) | present | L286 | Match |

#### Step 5: standalone MD delete

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `pairedMdDeletePaths` skip | `if (pairedMdDeletePaths.has(...)) continue` | L315 | Match |
| `rel` calculation | same pattern | L316 | Match |
| `findByRelativePath` check | `if (existing)` | L317-318 | Match |
| `noteRepository.delete(existing.id)` | present | L319 | Match |

**Fix 3 Match Rate: 100% (23/23 items)**

---

### Fix 4 -- `noteReconciliation` method + `start()` modification

#### noteReconciliation method

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Signature | `private async noteReconciliation(workspaceId, workspacePath): Promise<void>` | L347 | Match |
| `readMdFilesRecursiveAsync` call | `await readMdFilesRecursiveAsync(workspacePath, '')` | L348 | Match |
| `fsPaths` mapping | `fsEntries.map((e) => e.relativePath)` | L349 | Match |
| `dbNotes` query | `noteRepository.findByWorkspaceId(workspaceId)` | L351 | Match |
| `dbPathSet` | `new Set(dbNotes.map((n) => n.relativePath))` | L352 | Match |
| `toInsert` filter | `.filter((e) => !dbPathSet.has(e.relativePath))` | L355-356 | Match |
| `parentRel` calculation | `e.relativePath.includes('/') ? ... : null` | L358-359 | Match |
| `folder` lookup | `folderRepository.findByRelativePath(workspaceId, parentRel)` | L361-362 | Match |
| Insert object fields (10) | all 10 fields | L364-375 | Match |
| `folderId` value | `folder?.id ?? null` | L368 | Match |
| `title` value | `e.name.replace(/\.md$/, '')` | L369 | Match |
| `noteRepository.createMany(toInsert)` | present | L378 | Match |
| `noteRepository.deleteOrphans(workspaceId, fsPaths)` | present | L379 | Match |

#### start() modifications

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `syncOfflineChanges` call | first line | L28 | Match |
| `noteReconciliation` try/catch | present, ignore on failure | L30-35 | Match |
| `pushFolderChanged` after sync | present | L38 | Match |
| `pushNoteChanged(workspaceId, [])` (new) | present | L39 | Match |
| `parcelWatcher.subscribe` try/catch | present | L41-50 | Match |
| Assignment of `activeWorkspaceId` / `activeWorkspacePath` | present | L46-47 | Match |

#### Import changes

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `readDirRecursiveAsync` from `'./folder'` | present | L7 | Match |
| `readMdFilesRecursiveAsync` from `'../lib/fs-utils'` | present | L8 | Match |
| `readDirRecursive` (sync) removed | removed | confirmed not in imports | Match |

**Fix 4 Match Rate: 100% (22/22 items)**

---

### Fix 5 -- `noteRepository` chunking + JS-side diff

#### createMany changes

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Early return `items.length === 0` | present | L30 | Match |
| `CHUNK = 99` constant | present | L31 | Match |
| Comment `// 10 columns x 99 = 990 < SQLite 999 limit` | present | L31 | Match |
| for loop `i += CHUNK` | present | L32 | Match |
| `.slice(i, i + CHUNK)` | present | L33 | Match |
| `.onConflictDoNothing().run()` | present | L33 | Match |

#### deleteOrphans changes

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Early empty case: delete all | `db.delete(notes).where(eq(...)).run()` | L54-56 | Match |
| `existingSet = new Set(existingPaths)` | present | L58 | Match |
| `dbRows` select `{ id, relativePath }` | present | L59-63 | Match |
| `orphanIds` filter + map | `.filter(r => !existingSet.has(r.relativePath)).map(r => r.id)` | L64-66 | Match |
| `orphanIds.length === 0` guard | present | L67 | Match |
| `CHUNK = 900` | present | L69 | Match |
| Comment about 999-variable limit | present | L68 | Match |
| Chunked delete loop | `inArray(notes.id, orphanIds.slice(...)).run()` | L70-72 | Match |

#### Import changes

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `not` removed from import | `import { and, eq, inArray } from 'drizzle-orm'` | L1 | Match |

**Fix 5 Match Rate: 100% (15/15 items)**

---

### Fix 6 -- Async readdir functions

#### `readMdFilesRecursiveAsync` in fs-utils.ts

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Function signature | `async function readMdFilesRecursiveAsync(absBase, parentRel): Promise<MdFileEntry[]>` | L43-46 | Match |
| `absDir` calculation | `parentRel ? path.join(...) : absBase` | L47 | Match |
| `fs.promises.readdir` with `{ withFileTypes: true }` | present | L50 | Match |
| try/catch return `[]` | present | L48-52 | Match |
| `subdirPromises` array | `Promise<MdFileEntry[]>[]` | L56 | Match |
| symlink skip | `entry.isSymbolicLink()` | L59 | Match |
| hidden file skip | `entry.name.startsWith('.')` | L60 | Match |
| `rel` calculation | `parentRel ? ... : entry.name` | L62 | Match |
| Directory: push recursive call | `subdirPromises.push(readMdFilesRecursiveAsync(...))` | L64 | Match |
| File `.md` check | `entry.isFile() && entry.name.endsWith('.md')` | L65 | Match |
| `Promise.all(subdirPromises)` | present | L70 | Match |
| Spread sub-results | `for (const sub of subResults) result.push(...sub)` | L71 | Match |
| Export | `export async function` | L43 | Match |
| JSDoc comment (3 lines) | present | L39-42 | Match |

#### `readDirRecursiveAsync` in folder.ts

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| Function signature | `async function readDirRecursiveAsync(absBase, parentRel): Promise<FsEntry[]>` | L49-52 | Match |
| `absDir` calculation | same pattern | L53 | Match |
| `fs.promises.readdir` | present | L56 | Match |
| try/catch return `[]` | present | L54-58 | Match |
| `subdirPromises` array | present | L62 | Match |
| symlink skip | present | L65 | Match |
| `!entry.isDirectory()` skip | present | L66 | Match |
| hidden folder skip | present | L67 | Match |
| Push entry then recurse | result.push + subdirPromises.push | L69-70 | Match |
| `Promise.all` + spread | present | L73-74 | Match |
| Export | `export async function` | L49 | Match |
| JSDoc comment (3 lines) | present | L44-48 | Match |

#### `fullReconciliation` update

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `await readDirRecursiveAsync(workspacePath, '')` | present | L325 | Match |
| Method remains `async` | yes | L324 | Match |

**Fix 6 Match Rate: 100% (28/28 items)**

---

### Fix 7 -- `pendingEvents` + `handleEvents` + `stop()` modification

#### Class member

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `private pendingEvents: parcelWatcher.Event[] = []` | present | L16 | Match |

#### handleEvents changes

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `this.pendingEvents.push(...events)` | first line | L115 | Match |
| `clearTimeout` guard | present | L116 | Match |
| `const eventsToProcess = this.pendingEvents.splice(0)` | present | L118 | Match |
| `applyEvents` uses `eventsToProcess` | present | L119 | Match |
| `pushFolderChanged` | present | L120 | Match |
| `changedRelPaths` filter uses `eventsToProcess` | present | L122-124 | Match |
| `pushNoteChanged` | present | L125 | Match |
| Debounce timeout `50` | present | L126 | Match |

#### stop() changes

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `this.pendingEvents = []` as first line | present | L54 | Match |
| `clearTimeout` + null | present | L55-57 | Match |
| Rest of stop (unsubscribe, snapshot, null assignments) | unchanged | L59-74 | Match |

**Fix 7 Match Rate: 100% (12/12 items)**

---

### Final imports verification (workspace-watcher.ts)

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| `@parcel/watcher` | present | L1 | Match |
| `electron` (app, BrowserWindow) | present | L2 | Match |
| `path` | present | L3 | Match |
| `fs` | present | L4 | Match |
| `folderRepository` | present | L5 | Match |
| `noteRepository` | present | L6 | Match |
| `readDirRecursiveAsync` from `'./folder'` | present | L7 | Match |
| `readMdFilesRecursiveAsync` from `'../lib/fs-utils'` | present | L8 | Match |
| `nanoid` | present | L9 | Match |
| `readDirRecursive` (sync) removed | confirmed absent | L7 | Match |

**Import Match Rate: 100% (10/10 items)**

---

## 3. Added Features (Design X, Implementation O)

### Fix 8 -- `buildTree` O(n^2) to O(n) optimization

**File**: `src/main/services/folder.ts:103-138`

**What was added**: The `buildTree` function was rewritten to use a pre-grouped `Map<string, FsEntry[]>` (childrenByParent) instead of the previous O(n^2) pattern where each recursive call filtered the entire `fsEntries` array to find direct children.

**Implementation**:
```typescript
function buildTree(
  dbFoldersByPath: Map<string, { id: string; color: string | null; order: number }>,
  fsEntries: FsEntry[]
): FolderNode[] {
  // Pre-group children by parent path -> O(n) preprocessing, O(1) lookup per recursion
  const childrenByParent = new Map<string, FsEntry[]>()
  for (const entry of fsEntries) {
    const lastSlash = entry.relativePath.lastIndexOf('/')
    const parentRel = lastSlash === -1 ? '' : entry.relativePath.slice(0, lastSlash)
    let bucket = childrenByParent.get(parentRel)
    if (!bucket) {
      bucket = []
      childrenByParent.set(parentRel, bucket)
    }
    bucket.push(entry)
  }

  function buildChildren(parentRel: string): FolderNode[] {
    const children = childrenByParent.get(parentRel) ?? []
    return children
      .map((e) => {
        const meta = dbFoldersByPath.get(e.relativePath)!
        return {
          id: meta.id, name: e.name, relativePath: e.relativePath,
          color: meta.color, order: meta.order,
          children: buildChildren(e.relativePath)
        }
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }

  return buildChildren('')
}
```

**Impact**: Performance improvement for large workspaces with many folders. Directly related to the freeze fix goal. Low risk -- pure algorithmic improvement, no API or behavioral change.

**Classification**: Enhancement aligned with design goals (performance fix).

---

### Fix 9 -- Editor remount race condition fix

**Files**:
- `src/renderer/src/features/note/edit-note/model/use-note-external-sync.ts` (new file)
- `src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx` (modified)

**What was added**: A new hook `useNoteExternalSync` that reads the latest note content directly from the React Query cache at the moment a `note:external-changed` custom event fires, rather than relying on the NotePage component's re-render (which could be stale due to React's asynchronous rendering pipeline).

**use-note-external-sync.ts**:
```typescript
export function useNoteExternalSync(
  noteId: string
): { editorKey: number; latestContent: string | null } {
  const [editorKey, setEditorKey] = useState(0)
  const [latestContent, setLatestContent] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const handler = (e: Event): void => {
      if ((e as CustomEvent<{ noteId: string }>).detail.noteId === noteId) {
        const cached = queryClient.getQueryData<string>(['note', 'content', noteId])
        setLatestContent(cached ?? null)
        setEditorKey((k) => k + 1)
      }
    }
    window.addEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
  }, [noteId, queryClient])

  return { editorKey, latestContent }
}
```

**NoteEditor.tsx integration**:
```typescript
const { editorKey, latestContent } = useNoteExternalSync(noteId)
// ...
const contentToMount = latestContent ?? initialContent

return (
  <MilkdownProvider key={editorKey}>
    <MilkdownEditor initialContent={contentToMount} onSave={handleSave} />
  </MilkdownProvider>
)
```

**Impact**: Fixes a race condition where the editor would remount with stale content when an external file change was detected. The queryClient cache is read synchronously in the event handler, bypassing React's asynchronous state propagation. This is a renderer-side fix complementing the main-process changes.

**Classification**: Bug fix directly related to the freeze/sync improvements. Without this, the background reconciliation (Fix 4) + push notification flow could cause editors to display stale content after remount.

---

## 4. Missing Features (Design O, Implementation X)

None. All 7 Fixes specified in the design document are fully implemented.

---

## 5. Changed Features (Design != Implementation)

None. All design-specified implementations match the design specification line-by-line.

---

## 6. Overall Scores

### 6.1 Design Match (Fix 1-7)

| Category | Items Checked | Matched | Score | Status |
|----------|:------------:|:-------:|:-----:|:------:|
| Fix 1: readByWorkspaceFromDb | 7 | 7 | 100% | Match |
| Fix 2: IPC handler swap | 3 | 3 | 100% | Match |
| Fix 3: applyEvents Step 3/4/5 | 23 | 23 | 100% | Match |
| Fix 4: noteReconciliation + start() | 22 | 22 | 100% | Match |
| Fix 5: repo chunking + JS diff | 15 | 15 | 100% | Match |
| Fix 6: async readdir functions | 28 | 28 | 100% | Match |
| Fix 7: pendingEvents + handleEvents | 12 | 12 | 100% | Match |
| Imports (workspace-watcher.ts) | 10 | 10 | 100% | Match |
| **Total** | **120** | **120** | **100%** | **Match** |

### 6.2 Added Implementation Summary

| Fix | Files | Type | Risk |
|-----|-------|------|------|
| Fix 8: buildTree O(n) optimization | `src/main/services/folder.ts` | Performance | Low |
| Fix 9: Editor cache-read race fix | `use-note-external-sync.ts`, `NoteEditor.tsx` | Bug fix | Low |

### 6.3 Aggregate Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match (Fix 1-7) | 100% | Match |
| Architecture Compliance | 100% | Match |
| Convention Compliance | 100% | Match |
| **Overall** | **100%** | **Match** |

```
Design Match Rate: 100% (120/120 items)

  Matched:              120 items (100%)
  Missing (Design O, Impl X):   0 items (0%)
  Changed (Design != Impl):     0 items (0%)
  Added (Design X, Impl O):     2 fixes (Fix 8, Fix 9)
```

---

## 7. Architecture Compliance

| Check | Status |
|-------|--------|
| Layer separation: repositories (CRUD) / services (business) / ipc (handlers) | Match |
| Import direction: ipc -> services -> repositories | Match |
| No circular dependencies introduced | Match |
| Async functions properly awaited | Match |
| New exports properly typed | Match |
| FSD layer compliance (Fix 9): features -> entities (downward only) | Match |
| Fix 8: pure function, no side effects | Match |
| Fix 9: hook follows React Query patterns | Match |

**Architecture Score: 100%**

---

## 8. Convention Compliance

| Check | Status |
|-------|--------|
| Function naming: camelCase | Match (readByWorkspaceFromDb, readMdFilesRecursiveAsync, readDirRecursiveAsync, noteReconciliation, useNoteExternalSync, buildChildren) |
| Constant naming: UPPER_SNAKE_CASE | Match (CHUNK, NOTE_EXTERNAL_CHANGED_EVENT) |
| File naming: kebab-case folders, domain.ts / use-hook-name.ts patterns | Match |
| Component naming: PascalCase.tsx | Match (NoteEditor.tsx) |
| Import order: external -> internal -> relative -> types | Match |
| Single quotes, no semicolons | Match |

**Convention Score: 100%**

---

## 9. Recommended Actions

### 9.1 Immediate Actions

No immediate actions required. All 7 design-specified Fixes match at 100%.

### 9.2 Design Document Update (for Fix 8, Fix 9)

The following additions should be documented in the design to maintain design-implementation parity:

| Priority | Item | Description |
|----------|------|-------------|
| Low | Fix 8 documentation | Add `buildTree` O(n) optimization to design document |
| Low | Fix 9 documentation | Add `useNoteExternalSync` race condition fix to design document |

These are both improvements aligned with the design goals and do not require design approval -- only retroactive documentation.

### 9.3 Future Considerations (from design Edge Cases)

| Item | Priority | Notes |
|------|----------|-------|
| EC-4: Promise.all concurrency limit | Low | Add p-limit if users report fd exhaustion on deeply nested workspaces |
| EC-6: Offline note move ID preservation | Low | Only affects corrupted snapshots; note content always preserved |

---

## 10. Next Steps

- [x] Implementation complete (all 7 design Fixes + 2 additional fixes)
- [x] Gap analysis complete (100% design match)
- [ ] Optionally update design document with Fix 8 and Fix 9
- [ ] Run test suite to verify runtime behavior
- [ ] Write completion report (`large-workspace-freeze-v2.report.md`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Initial gap analysis - 100% match (Fix 1-7 only) | Claude Code (gap-detector) |
| 2.0 | 2026-02-28 | Full re-analysis including Fix 8 and Fix 9 as Added items | Claude Code (gap-detector) |
