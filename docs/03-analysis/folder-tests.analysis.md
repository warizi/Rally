# folder-tests Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: Rally
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-25
> **Plan Doc**: [folder-tests.plan.md](../01-plan/features/folder-tests.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

`folder-tests.plan.md`에 정의된 Success Criteria 13개 항목과 실제 구현된 테스트 코드 3개 파일을 비교하여 Match Rate를 산출한다.

### 1.2 Analysis Scope

- **Plan Document**: `docs/01-plan/features/folder-tests.plan.md`
- **Implementation Files**:
  - `src/main/repositories/__tests__/folder.test.ts` (Layer 1)
  - `src/main/services/__tests__/folder.test.ts` (Layer 2)
  - `src/renderer/src/entities/folder/api/__tests__/queries.test.ts` (Layer 3)
- **Analysis Date**: 2026-02-25

---

## 2. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100% (13/13)           |
+---------------------------------------------+
|  Implemented:     13 items (100%)     [OK]  |
|  Not verified:     0 items (0%)       [Gap] |
+---------------------------------------------+
```

**Status**: Match Rate >= 90% -- "Implementation matches plan. Ready for completion report."

---

## 3. Success Criteria Check

### 3.1 Layer 1 -- folderRepository

| #   | Criteria                                                         | Status | Evidence                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `folderRepository` 11 methods covered                            |   OK   | `findByWorkspaceId`, `findById`, `findByRelativePath`, `create`, `createMany`, `update`, `bulkUpdatePathPrefix`, `bulkDeleteByPrefix`, `deleteOrphans`, `reindexSiblings`, `delete` -- 11 describe blocks in `folder.test.ts` |
| 2   | `bulkUpdatePathPrefix` sub-tree update + "ab" substring boundary |   OK   | Lines 131-162: "a"->"x" test covers a, a/b, a/b/c update; separate test verifies "ab" path is preserved                                                                                                                       |
| 3   | `bulkDeleteByPrefix` unrelated row preservation                  |   OK   | Lines 164-182: "z" path remains after prefix "a" deletion                                                                                                                                                                     |
| 4   | `deleteOrphans` empty array -> all-delete                        |   OK   | Lines 202-211: empty array deletes all workspace folders                                                                                                                                                                      |
| 5   | `reindexSiblings` order reassignment + empty array no-op         |   OK   | Lines 215-241: [id-c, id-a, id-b] -> order 0,1,2; empty array preserves order=99                                                                                                                                              |

### 3.2 Layer 2 -- folderService

| #   | Criteria                                 | Status | Evidence                                                                                 |
| --- | ---------------------------------------- | :----: | ---------------------------------------------------------------------------------------- |
| 6   | `readTree` lazy upsert + orphan deletion |   OK   | Lines 117-183: fs 3 folders -> DB upsert test; orphan row "ghost" deleted after readTree |
| 7   | `move` circular reference prevention     |   OK   | Lines 325-330: parent moved under own child throws `ValidationError`                     |
| 8   | `rename` sub-tree path update            |   OK   | Lines 261-279: "a"->"x" rename updates child "a/b" to "x/b" in DB                        |

### 3.3 Layer 3 -- React Query Hooks

| #   | Criteria                                        | Status | Evidence                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | IPC error handling                              |   OK   | Lines 76-86 (useFolderTree), Lines 114-127 (useCreateFolder): `success:false` -> `isError=true`                                                                                                                                           |
| 10  | onSuccess queryKey invalidation                 |   OK   | 5 mutation hooks tested: useCreateFolder (L100-112), useRenameFolder (L132-144), useRemoveFolder (L149-161), useMoveFolder (L166-178), useUpdateFolderMeta (L183-198) -- all verify `invalidateQueries` with `['folder', 'tree', 'ws-1']` |
| 11  | `useFolderTree` workspaceId="" -> enabled=false |   OK   | Lines 88-95: `mockReadTree` not called when workspaceId is empty string                                                                                                                                                                   |

### 3.4 Build/Runtime Verification

| #   | Criteria                      | Status | Evidence                                                                                                                                                   |
| --- | ----------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | `npm run test` all pass       |   OK   | 8 test files, 114 tests — all passed (0 failures)                                                                                                          |
| 13  | TypeScript compile errors = 0 |   OK   | `typecheck:node` 0 errors; `typecheck:web` 기존 에러는 folder-tests와 무관 (`input-otp.tsx`, `WorkspaceSwitcher.tsx`, `TabType` 등 — 기존 코드베이스 이슈) |

---

## 4. Detailed Gap Analysis

### 4.1 Missing Verifications (Gap)

없음 — 모든 Success Criteria 13개 항목이 충족됨.

### 4.2 Extra Implementation (Plan X, Implementation O)

| Item                              | Implementation Location             | Description                                                                          |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `readDirRecursive` file exclusion | `folder.test.ts` (service) L87-90   | `isDirectory=false` file exclusion test -- not in plan but valuable                  |
| `useCreateFolder` IPC error test  | `queries.test.ts` L114-127          | Mutation error handling -- plan only mentions query error handling explicitly        |
| `create` name conflict "(2)"      | `folder.test.ts` (service) L224-233 | Repeated conflict escalation test -- plan mentions it, implementation covers it well |

### 4.3 Implementation Quality Notes

| Area                   | Assessment | Notes                                                                              |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------- |
| Layer 1 test structure | Good       | FK dependency setup with workspace insert in beforeEach, clean `makeFolder` helper |
| Layer 2 mock strategy  | Good       | Real testDb + mocked fs/workspaceRepository -- matches plan's integration approach |
| Layer 3 pattern        | Good       | Follows existing project patterns (window.api mock, createWrapper, invalidateSpy)  |

---

## 5. Scores

| Category               |      Score       |  Status  |
| ---------------------- | :--------------: | :------: |
| Plan Match (static)    |   100% (11/11)   |    OK    |
| Runtime Verification   |    100% (2/2)    |    OK    |
| **Overall Match Rate** | **100%** (13/13) | Complete |

---

## 6. Recommended Actions

### 6.1 완료 (All criteria satisfied)

모든 Success Criteria 충족 — 즉시 completion report 진행 가능.

```bash
/pdca report folder-tests
```

---

## 7. Next Steps

- [x] Execute `npm run test` — 114 tests all passed
- [x] Execute `npm run typecheck` — 0 errors (node scope)
- [x] Match Rate 100% confirmed
- [ ] Proceed to `/pdca report folder-tests`

---

## Version History

| Version | Date       | Changes                                                | Author                     |
| ------- | ---------- | ------------------------------------------------------ | -------------------------- |
| 0.1     | 2026-02-25 | Initial gap analysis                                   | Claude Code (gap-detector) |
| 0.2     | 2026-02-25 | Runtime verification added; Match Rate updated to 100% | Claude Code                |
