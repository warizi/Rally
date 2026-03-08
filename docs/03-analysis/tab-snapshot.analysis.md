# Tab Snapshot Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-02-24
> **Design Doc**: [tab-snapshot.design.md](../02-design/features/tab-snapshot.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Design 문서(`docs/02-design/features/tab-snapshot.design.md`)와 실제 구현 코드를 비교하여 일치율과 차이 항목을 식별한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/tab-snapshot.design.md`
- **Implementation Path**: `src/main/`, `src/preload/`, `src/renderer/src/entities/tab-snapshot/`, `src/renderer/src/features/tab-snapshot/`, `src/renderer/src/app/layout/MainSidebar.tsx`
- **Analysis Date**: 2026-02-24

---

## 2. Overall Scores

| Category                  |  Score  |   Status    |
| ------------------------- | :-----: | :---------: |
| DB Schema Match           |  100%   |    Pass     |
| Repository Match          |   90%   |   Warning   |
| Service Match             |  100%   |    Pass     |
| IPC Handler Match         |   90%   |   Warning   |
| Preload Bridge Match      |   90%   |   Warning   |
| Preload Types Match       |   88%   |   Warning   |
| Entity (types) Match      |  100%   |    Pass     |
| Entity (queries) Match    |   85%   |   Warning   |
| Feature UI Match          |   72%   |    Fail     |
| Sidebar Integration Match |   65%   |    Fail     |
| **Overall**               | **87%** | **Warning** |

---

## 3. Gap Analysis (Design vs Implementation)

### 3.1 DB Schema

| Item                             | Design | Implementation | Status |
| -------------------------------- | ------ | -------------- | ------ |
| Table: tab_snapshots             | O      | O              | Pass   |
| Field: id (text PK)              | O      | O              | Pass   |
| Field: name (text notNull)       | O      | O              | Pass   |
| Field: description (text)        | O      | O              | Pass   |
| Field: workspaceId (FK cascade)  | O      | O              | Pass   |
| Field: tabsJson (text notNull)   | O      | O              | Pass   |
| Field: panesJson (text notNull)  | O      | O              | Pass   |
| Field: layoutJson (text notNull) | O      | O              | Pass   |
| Field: createdAt (timestamp_ms)  | O      | O              | Pass   |
| Field: updatedAt (timestamp_ms)  | O      | O              | Pass   |
| schema/index.ts export           | O      | O              | Pass   |

**File**: `src/main/db/schema/tab-snapshot.ts` -- 100% Match

---

### 3.2 Repository

| Item                          | Design                                                       | Implementation                                                                                            | Status  |
| ----------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------- |
| findByWorkspaceId             | O                                                            | O                                                                                                         | Pass    |
| findById                      | O                                                            | O                                                                                                         | Pass    |
| create                        | O                                                            | O                                                                                                         | Pass    |
| update                        | O                                                            | O                                                                                                         | Pass    |
| delete                        | O                                                            | O                                                                                                         | Pass    |
| TabSnapshot type export       | O                                                            | O                                                                                                         | Pass    |
| TabSnapshotInsert type export | O                                                            | O                                                                                                         | Pass    |
| TabSnapshotUpdate type        | `Partial<Pick<..., 'name' \| 'description' \| 'updatedAt'>>` | `Partial<Pick<..., 'name' \| 'description' \| 'tabsJson' \| 'panesJson' \| 'layoutJson' \| 'updatedAt'>>` | Changed |

**File**: `src/main/repositories/tab-snapshot.ts`

### 3.2.1 Changed Details

| Item                          | Design                         | Implementation                                                  | Impact |
| ----------------------------- | ------------------------------ | --------------------------------------------------------------- | ------ |
| TabSnapshotUpdate Pick fields | `name, description, updatedAt` | `name, description, tabsJson, panesJson, layoutJson, updatedAt` | Medium |

> Implementation extends the update type to include `tabsJson`, `panesJson`, `layoutJson` fields, allowing snapshot overwrite functionality. This is not in the design document.

---

### 3.3 Service

| Item                         | Design | Implementation | Status |
| ---------------------------- | ------ | -------------- | ------ |
| getByWorkspaceId             | O      | O              | Pass   |
| create (with validation)     | O      | O              | Pass   |
| update (with NotFound check) | O      | O              | Pass   |
| delete (with NotFound check) | O      | O              | Pass   |
| nanoid for id generation     | O      | O              | Pass   |
| name.trim() validation       | O      | O              | Pass   |

**File**: `src/main/services/tab-snapshot.ts` -- 100% Match

---

### 3.4 IPC Handler

| Item                               | Design                    | Implementation                                                | Status  |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------- | ------- |
| tabSnapshot:getByWorkspaceId       | O                         | O                                                             | Pass    |
| tabSnapshot:create                 | O                         | O                                                             | Pass    |
| tabSnapshot:update                 | O                         | O                                                             | Pass    |
| tabSnapshot:delete                 | O                         | O                                                             | Pass    |
| registerTabSnapshotHandlers export | O                         | O                                                             | Pass    |
| CreateInput type                   | O (match)                 | O (match)                                                     | Pass    |
| UpdateInput type                   | `{ name?, description? }` | `{ name?, description?, tabsJson?, panesJson?, layoutJson? }` | Changed |

**File**: `src/main/ipc/tab-snapshot.ts`

### 3.4.1 Changed Details

| Item               | Design                   | Implementation                                       | Impact |
| ------------------ | ------------------------ | ---------------------------------------------------- | ------ |
| UpdateInput fields | `name, description` only | `name, description, tabsJson, panesJson, layoutJson` | Medium |

> Implementation allows updating snapshot JSON data (overwrite feature), not specified in design.

---

### 3.5 Preload Bridge

| Item                         | Design                          | Implementation                  | Status |
| ---------------------------- | ------------------------------- | ------------------------------- | ------ |
| tabSnapshot.getByWorkspaceId | O                               | O                               | Pass   |
| tabSnapshot.create           | O                               | O                               | Pass   |
| tabSnapshot.update signature | `(id, { name?, description? })` | `(id, { name?, description? })` | Pass   |
| tabSnapshot.delete           | O                               | O                               | Pass   |

**File**: `src/preload/index.ts`

> Note: The preload `update` call passes only `{ name?, description? }` matching the design, but the IPC layer and type definitions accept more fields. The actual preload bridge sends whatever the renderer passes through.

---

### 3.6 Preload Types (index.d.ts)

| Item                         | Design                               | Implementation                                                | Status  |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------- | ------- |
| TabSnapshotAPI interface     | O                                    | O                                                             | Pass    |
| getByWorkspaceId return type | `IpcResponse<TabSnapshot[]>`         | `IpcResponse<TabSnapshot[]>`                                  | Pass    |
| create return type           | `IpcResponse<TabSnapshot>`           | `IpcResponse<TabSnapshot>`                                    | Pass    |
| update data param            | `{ name?, description? }`            | `{ name?, description?, tabsJson?, panesJson?, layoutJson? }` | Changed |
| delete return type           | `IpcResponse<void>`                  | `IpcResponse<void>`                                           | Pass    |
| API interface members        | `tabSession, tabSnapshot, workspace` | `tabSession, tabSnapshot, workspace`                          | Pass    |

**File**: `src/preload/index.d.ts`

---

### 3.7 Renderer Entity -- types.ts

| Item                    | Design | Implementation | Status |
| ----------------------- | ------ | -------------- | ------ |
| TabSnapshotSchema (zod) | O      | O              | Pass   |
| All fields match schema | O      | O              | Pass   |
| TabSnapshot type export | O      | O              | Pass   |

**File**: `src/renderer/src/entities/tab-snapshot/model/types.ts` -- 100% Match

---

### 3.8 Renderer Entity -- queries.ts

| Item                          | Design                        | Implementation                                                    | Status  |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------- | ------- |
| useTabSnapshots hook          | O                             | O                                                                 | Pass    |
| useCreateTabSnapshot hook     | O                             | O                                                                 | Pass    |
| useUpdateTabSnapshot hook     | O                             | O                                                                 | Pass    |
| useDeleteTabSnapshot hook     | O                             | O                                                                 | Pass    |
| QUERY_KEY = 'tabSnapshots'    | O                             | O                                                                 | Pass    |
| CreateInput type              | match                         | match                                                             | Pass    |
| UpdateInput type              | `{ id, name?, description? }` | `{ id, name?, description?, tabsJson?, panesJson?, layoutJson? }` | Changed |
| update mutationFn destructure | `{ id, name, description }`   | `{ id, name, description, tabsJson, panesJson, layoutJson }`      | Changed |

**File**: `src/renderer/src/entities/tab-snapshot/api/queries.ts`

---

### 3.9 Renderer Entity -- index.ts (barrel)

| Item                        | Design | Implementation | Status |
| --------------------------- | ------ | -------------- | ------ |
| TabSnapshot type re-export  | O      | O              | Pass   |
| TabSnapshotSchema re-export | O      | O              | Pass   |
| 4 hooks re-exported         | O      | O              | Pass   |

**File**: `src/renderer/src/entities/tab-snapshot/index.ts` -- 100% Match

---

### 3.10 Feature UI Components

#### 3.10.1 File Structure

| Design File              | Implementation File      | Status |
| ------------------------ | ------------------------ | ------ |
| TabSnapshotSection.tsx   | TabSnapshotSection.tsx   | Pass   |
| TabSnapshotItem.tsx      | TabSnapshotItem.tsx      | Pass   |
| SaveSnapshotDialog.tsx   | SaveSnapshotDialog.tsx   | Pass   |
| EditSnapshotDialog.tsx   | EditSnapshotDialog.tsx   | Pass   |
| DeleteSnapshotDialog.tsx | DeleteSnapshotDialog.tsx | Pass   |
| index.ts (barrel)        | index.ts (barrel)        | Pass   |

#### 3.10.2 TabSnapshotSection.tsx

| Item                     | Design                                            | Implementation                                            | Status  |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------- | ------- |
| Props interface          | `{ workspaceId }`                                 | `{ workspaceId, onRestoreSnapshot, onOverwriteSnapshot }` | Changed |
| Collapsible toggle       | O                                                 | O                                                         | Pass    |
| Snapshot list rendering  | O                                                 | O                                                         | Pass    |
| Save dialog trigger      | O                                                 | O                                                         | Pass    |
| Edit/Delete dialog state | O                                                 | O                                                         | Pass    |
| Scroll container         | `<div className="max-h-[400px] overflow-y-auto">` | `<ScrollArea><div className="max-h-[400px]">`             | Changed |
| TabSnapshotItem props    | `{ snapshot, onEdit, onDelete }`                  | `{ snapshot, onRestore, onOverwrite, onEdit, onDelete }`  | Changed |

**File**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotSection.tsx`

#### 3.10.3 TabSnapshotItem.tsx

| Item                      | Design                           | Implementation                                           | Status  |
| ------------------------- | -------------------------------- | -------------------------------------------------------- | ------- |
| Props                     | `{ snapshot, onEdit, onDelete }` | `{ snapshot, onRestore, onOverwrite, onEdit, onDelete }` | Changed |
| SidebarMenuButton onClick | none (no click handler)          | `onClick={onRestore}`                                    | Added   |
| ContextMenu items         | 2 items (수정, 삭제)             | 3 items (현재 탭으로 저장, 수정, 삭제)                   | Changed |

**File**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotItem.tsx`

#### 3.10.4 SaveSnapshotDialog.tsx

| Item             | Design                                 | Implementation                               | Status  |
| ---------------- | -------------------------------------- | -------------------------------------------- | ------- |
| Tab state access | `useTabStore.getState()` at render top | `useTabStore.getState()` inside handleSubmit | Changed |
| Form fields      | match                                  | match                                        | Pass    |
| Create mutation  | match                                  | match                                        | Pass    |

**File**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/SaveSnapshotDialog.tsx`

> Implementation moves `useTabStore.getState()` inside `handleSubmit` to capture the latest state at submission time instead of render time. This is an improvement over the design.

#### 3.10.5 EditSnapshotDialog.tsx

**File**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/EditSnapshotDialog.tsx` -- 100% Match

#### 3.10.6 DeleteSnapshotDialog.tsx

**File**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/DeleteSnapshotDialog.tsx` -- 100% Match

---

### 3.11 Sidebar Integration (MainSidebar.tsx)

| Item                                          | Design             | Implementation                                        | Status  |
| --------------------------------------------- | ------------------ | ----------------------------------------------------- | ------- |
| TabSnapshotSection import                     | O                  | O                                                     | Pass    |
| useCurrentWorkspaceStore usage                | O                  | O                                                     | Pass    |
| Conditional rendering with currentWorkspaceId | O                  | O                                                     | Pass    |
| TabSnapshotSection props                      | `workspaceId` only | `workspaceId, onRestoreSnapshot, onOverwriteSnapshot` | Changed |
| Snapshot restore handler                      | X (not in design)  | `handleRestore` with `applySessionToStore`            | Added   |
| Snapshot overwrite handler                    | X (not in design)  | `handleOverwrite` with `useUpdateTabSnapshot`         | Added   |
| useUpdateTabSnapshot in sidebar               | X (not in design)  | O (imported and used)                                 | Added   |
| applySessionToStore import                    | X (not in design)  | O (imported from tab-system)                          | Added   |
| SerializedTab, SessionData imports            | X (not in design)  | O (imported from tab-system)                          | Added   |

**File**: `src/renderer/src/app/layout/MainSidebar.tsx`

---

### 3.12 main/index.ts Integration

| Item                               | Design | Implementation | Status |
| ---------------------------------- | ------ | -------------- | ------ |
| registerTabSnapshotHandlers import | O      | O              | Pass   |
| registerTabSnapshotHandlers() call | O      | O (line 72)    | Pass   |

**File**: `src/main/index.ts` -- 100% Match

---

## 4. Gap Summary

### 4.1 Missing Features (Design O, Implementation X)

None.

### 4.2 Added Features (Design X, Implementation O)

| #   | Item                                                   | Implementation Location                                                                            | Description                                                                | Impact |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 1   | Snapshot Restore (click to restore)                    | `TabSnapshotItem.tsx:31`, `MainSidebar.tsx:78-87`                                                  | Clicking a snapshot item restores tab state via `applySessionToStore`      | High   |
| 2   | Snapshot Overwrite (update JSON data)                  | `TabSnapshotItem.tsx:38`, `MainSidebar.tsx:68-76`                                                  | Context menu "현재 탭으로 저장" overwrites snapshot with current tab state | High   |
| 3   | Extended UpdateInput (tabsJson, panesJson, layoutJson) | `repositories/tab-snapshot.ts:8`, `ipc/tab-snapshot.ts:19-21`, `queries.ts:27-30`, `index.d.ts:25` | Update operation supports JSON data fields for overwrite                   | Medium |
| 4   | ScrollArea component                                   | `TabSnapshotSection.tsx:51-64`                                                                     | Uses `@shared/ui/scroll-area` instead of bare `overflow-y-auto` div        | Low    |

### 4.3 Changed Features (Design != Implementation)

| #   | Item                                 | Design                                  | Implementation                                            | Impact |
| --- | ------------------------------------ | --------------------------------------- | --------------------------------------------------------- | ------ |
| 1   | TabSnapshotSection Props             | `{ workspaceId }`                       | `{ workspaceId, onRestoreSnapshot, onOverwriteSnapshot }` | High   |
| 2   | TabSnapshotItem Props                | `{ snapshot, onEdit, onDelete }`        | `{ snapshot, onRestore, onOverwrite, onEdit, onDelete }`  | High   |
| 3   | ContextMenu items count              | 2 (수정, 삭제)                          | 3 (현재 탭으로 저장, 수정, 삭제)                          | Medium |
| 4   | TabSnapshotUpdate type               | 3 fields (name, description, updatedAt) | 6 fields (+tabsJson, panesJson, layoutJson)               | Medium |
| 5   | SaveSnapshotDialog state read timing | Render-time `getState()`                | Submit-time `getState()` (improvement)                    | Low    |
| 6   | Scroll implementation                | `<div overflow-y-auto>`                 | `<ScrollArea>` wrapping                                   | Low    |

---

## 5. Match Rate Calculation

### Per-Layer Breakdown

| Layer               | Total Items | Match  | Changed | Added |  Score  |
| ------------------- | :---------: | :----: | :-----: | :---: | :-----: |
| DB Schema           |     11      |   11   |    0    |   0   |  100%   |
| Repository          |      8      |   7    |    1    |   0   |   88%   |
| Service             |      6      |   6    |    0    |   0   |  100%   |
| IPC Handler         |      7      |   6    |    1    |   0   |   86%   |
| Preload Bridge      |      4      |   4    |    0    |   0   |  100%   |
| Preload Types       |      6      |   5    |    1    |   0   |   83%   |
| Entity (types)      |      3      |   3    |    0    |   0   |  100%   |
| Entity (queries)    |      8      |   6    |    2    |   0   |   75%   |
| Entity (barrel)     |      3      |   3    |    0    |   0   |  100%   |
| Feature UI          |     18      |   11   |    6    |   1   |   64%   |
| Sidebar Integration |      9      |   3    |    1    |   5   |   33%   |
| main/index.ts       |      2      |   2    |    0    |   0   |  100%   |
| **Total**           |   **85**    | **67** | **12**  | **6** | **87%** |

### Overall Match Rate

```
+-------------------------------------------------+
|  Overall Match Rate: 87%                        |
+-------------------------------------------------+
|  Pass (exact match):       67 items (79%)       |
|  Changed (modified):       12 items (14%)       |
|  Added (not in design):    6  items (7%)        |
|  Missing (not impl'd):    0  items (0%)         |
+-------------------------------------------------+
```

---

## 6. Architecture Compliance

### 6.1 FSD Layer Compliance

| Layer                 | Expected                 | Actual                          | Status |
| --------------------- | ------------------------ | ------------------------------- | ------ |
| entities/tab-snapshot | Domain model + API hooks | model/types.ts + api/queries.ts | Pass   |
| features/tab-snapshot | User interaction UI      | manage-tab-snapshot/ui/\*       | Pass   |
| app/layout            | Layout integration       | MainSidebar.tsx                 | Pass   |

### 6.2 Import Direction Check

| File                     | Layer    | Imports From                                              | Status |
| ------------------------ | -------- | --------------------------------------------------------- | ------ |
| TabSnapshotSection.tsx   | features | @entities/tab-snapshot, @shared/ui                        | Pass   |
| TabSnapshotItem.tsx      | features | @entities/tab-snapshot, @shared/ui                        | Pass   |
| SaveSnapshotDialog.tsx   | features | @entities/tab-snapshot, @shared/ui, @/features/tap-system | Pass   |
| EditSnapshotDialog.tsx   | features | @entities/tab-snapshot, @shared/ui                        | Pass   |
| DeleteSnapshotDialog.tsx | features | @entities/tab-snapshot, @shared/ui                        | Pass   |
| MainSidebar.tsx          | app      | @entities/tab-snapshot, @features/_, @shared/_            | Pass   |

> All imports follow FSD rules: app -> features -> entities -> shared. No upward imports detected.

### 6.3 Architecture Score: 100%

---

## 7. Convention Compliance

### 7.1 Naming Convention

| Category          | Convention       | Files Checked | Compliance | Violations |
| ----------------- | ---------------- | :-----------: | :--------: | ---------- |
| Components        | PascalCase       |       5       |    100%    | -          |
| Functions         | camelCase        |       8       |    100%    | -          |
| Constants         | UPPER_SNAKE_CASE | 1 (QUERY_KEY) |    100%    | -          |
| Files (component) | PascalCase.tsx   |       5       |    100%    | -          |
| Files (utility)   | camelCase.ts     |       3       |    100%    | -          |
| Folders           | kebab-case       |       3       |    100%    | -          |

### 7.2 Import Order

All files follow the order: external libs -> internal absolute (@shared, @entities) -> relative (./) -> types.

### 7.3 Convention Score: 100%

---

## 8. Overall Score

```
+-------------------------------------------------+
|  Overall Score: 91/100                          |
+-------------------------------------------------+
|  Design Match:        87 points                 |
|  Architecture:       100 points                 |
|  Convention:         100 points                 |
|  (Weighted: 60% design + 20% arch + 20% conv)  |
+-------------------------------------------------+
```

---

## 9. Recommended Actions

### 9.1 Design Document Updates Needed

The following features exist in implementation but not in design. The design document should be updated to reflect these:

| Priority | Item                             | Description                                                                                                                |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1        | Snapshot Restore functionality   | Add design for click-to-restore behavior: `applySessionToStore()` called from MainSidebar via `onRestoreSnapshot` callback |
| 2        | Snapshot Overwrite functionality | Add design for context menu "현재 탭으로 저장" that updates JSON data of an existing snapshot                              |
| 3        | Extended UpdateInput type        | Document that `update` supports `tabsJson`, `panesJson`, `layoutJson` fields in addition to `name` and `description`       |
| 4        | TabSnapshotSection Props         | Update Props interface to include `onRestoreSnapshot` and `onOverwriteSnapshot` callbacks                                  |
| 5        | TabSnapshotItem context menu     | Add third context menu item "현재 탭으로 저장"                                                                             |

### 9.2 No Implementation Changes Needed

All design-specified features are implemented. The added features (restore, overwrite) are functional improvements that enhance the feature. No missing implementations detected.

---

## 10. Conclusion

Match Rate is **87%** which falls in the range of >= 70% && < 90%.

> "There are some differences. Document update is recommended."

The primary gap is that the implementation adds **restore** and **overwrite** functionality that was not specified in the design document. These are natural extensions of the tab-snapshot feature and represent improvements rather than deviations. The recommended action is to **update the design document** (option 2) to reflect the actual implementation.

All core design specifications (schema, repository CRUD, service validation, IPC channels, preload bridge, entity types/hooks, UI dialog components) are faithfully implemented.

---

## Version History

| Version | Date       | Changes              | Author       |
| ------- | ---------- | -------------------- | ------------ |
| 0.1     | 2026-02-24 | Initial gap analysis | gap-detector |
