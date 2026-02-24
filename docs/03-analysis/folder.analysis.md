# Folder (파일 탐색기) Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-24
> **Design Doc**: [folder.design.md](../02-design/features/folder.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

설계 문서(folder.design.md)와 실제 구현 코드 간의 일치도를 검증하고, 누락/변경/추가된 항목을 식별한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/folder.design.md`
- **Implementation**: Main process, Preload, Renderer (총 20개 파일)
- **Analysis Date**: 2026-02-24

---

## 2. Overall Scores

| Category                |  Score  | Status |
| ----------------------- | :-----: | :----: |
| Design Match            |   98%   |   ✅   |
| Architecture Compliance |  100%   |   ✅   |
| Convention Compliance   |  100%   |   ✅   |
| **Overall**             | **99%** |   ✅   |

```
+---------------------------------------------+
|  Overall Match Rate: 99%                    |
+---------------------------------------------+
|  ✅ Exact Match:      18 / 20 files (90%)   |
|  ⚠️ Minor Diff:        2 / 20 files (10%)   |
|  ❌ Not Implemented:   0 / 20 files ( 0%)   |
+---------------------------------------------+
```

---

## 3. Section-by-Section Comparison

### 3.1 DB Schema (`src/main/db/schema/folder.ts`)

| Item                              | Design    | Implementation | Status |
| --------------------------------- | --------- | -------------- | ------ |
| Table name                        | `folders` | `folders`      | ✅     |
| id (text, PK)                     | ✅        | ✅             | ✅     |
| workspaceId (FK, cascade)         | ✅        | ✅             | ✅     |
| relativePath (text, notNull)      | ✅        | ✅             | ✅     |
| color (text, nullable)            | ✅        | ✅             | ✅     |
| order (integer, default 0)        | ✅        | ✅             | ✅     |
| createdAt (timestamp_ms)          | ✅        | ✅             | ✅     |
| updatedAt (timestamp_ms)          | ✅        | ✅             | ✅     |
| unique(workspaceId, relativePath) | ✅        | ✅             | ✅     |

**Result: 100% Match**

### 3.2 Schema Index (`src/main/db/schema/index.ts`)

| Item                | Design | Implementation | Status |
| ------------------- | ------ | -------------- | ------ |
| folders export 추가 | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.3 Repository (`src/main/repositories/folder.ts`)

| Method               | Design | Implementation | Status |
| -------------------- | ------ | -------------- | ------ |
| findByWorkspaceId    | ✅     | ✅             | ✅     |
| findById             | ✅     | ✅             | ✅     |
| findByRelativePath   | ✅     | ✅             | ✅     |
| create               | ✅     | ✅             | ✅     |
| createMany           | ✅     | ✅             | ✅     |
| update               | ✅     | ✅             | ✅     |
| bulkUpdatePathPrefix | ✅     | ✅             | ✅     |
| bulkDeleteByPrefix   | ✅     | ✅             | ✅     |
| deleteOrphans        | ✅     | ✅             | ✅     |
| reindexSiblings      | ✅     | ✅             | ✅     |
| delete               | ✅     | ✅             | ✅     |

**Result: 100% Match**

> Note: `deleteOrphans` 메서드의 JSDoc 주석이 미세하게 다름 (설계: "readDirRecursive가 accessSync 실패 시..." / 구현: "서비스 레이어에서 미리 accessSync 체크 후..."). 로직은 동일.

### 3.4 Service (`src/main/services/folder.ts`)

| Method/Item                    | Design | Implementation | Status |
| ------------------------------ | ------ | -------------- | ------ |
| readDirRecursive (export)      | ✅     | ✅             | ✅     |
| normalizePath (private)        | ✅     | ✅             | ✅     |
| resolveNameConflict (private)  | ✅     | ✅             | ✅     |
| resolveParentAbsPath (private) | ✅     | ✅             | ✅     |
| FolderNode interface           | ✅     | ✅             | ✅     |
| buildTree (private)            | ✅     | ✅             | ✅     |
| folderService.readTree         | ✅     | ✅             | ✅     |
| folderService.create           | ✅     | ✅             | ✅     |
| folderService.rename           | ✅     | ✅             | ✅     |
| folderService.remove           | ✅     | ✅             | ✅     |
| folderService.move             | ✅     | ✅             | ✅     |
| folderService.updateMeta       | ✅     | ✅             | ⚠️     |

**Result: 99% Match**

> MINOR: `updateMeta`의 첫 번째 파라미터가 설계에서는 `workspaceId`이나 구현에서는 `_workspaceId`로 명명됨 (unused 파라미터 표시). 동작에는 영향 없음.

### 3.5 FolderWatcher (`src/main/services/folder-watcher.ts`)

| Method/Item                        | Design | Implementation | Status |
| ---------------------------------- | ------ | -------------- | ------ |
| FolderWatcherService class         | ✅     | ✅             | ✅     |
| private fields (4개)               | ✅     | ✅             | ✅     |
| ensureWatching                     | ✅     | ✅             | ✅     |
| start                              | ✅     | ✅             | ✅     |
| stop (+ snapshot 저장)             | ✅     | ✅             | ✅     |
| syncOfflineChanges                 | ✅     | ✅             | ✅     |
| handleEvents (debounce 50ms)       | ✅     | ✅             | ✅     |
| applyEvents (create/delete/rename) | ✅     | ✅             | ✅     |
| fullReconciliation                 | ✅     | ✅             | ✅     |
| getSnapshotPath                    | ✅     | ✅             | ✅     |
| pushChanged                        | ✅     | ✅             | ✅     |
| singleton export                   | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.6 IPC Handler (`src/main/ipc/folder.ts`)

| Channel                            | Design | Implementation | Status |
| ---------------------------------- | ------ | -------------- | ------ |
| folder:readTree (+ watcher 활성화) | ✅     | ✅             | ✅     |
| folder:create                      | ✅     | ✅             | ✅     |
| folder:rename                      | ✅     | ✅             | ✅     |
| folder:remove                      | ✅     | ✅             | ✅     |
| folder:move                        | ✅     | ✅             | ✅     |
| folder:updateMeta                  | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.7 Main Index (`src/main/index.ts`)

| Item                                  | Design | Implementation | Status |
| ------------------------------------- | ------ | -------------- | ------ |
| registerFolderHandlers() 호출         | ✅     | ✅             | ✅     |
| before-quit hook (folderWatcher.stop) | ✅     | ✅             | ✅     |
| isQuitting 가드                       | ✅     | ✅             | ✅     |
| 1초 타임아웃                          | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.8 Workspace IPC (`src/main/ipc/workspace.ts`)

| Item                               | Design | Implementation | Status |
| ---------------------------------- | ------ | -------------- | ------ |
| folderWatcher import               | ✅     | ✅             | ✅     |
| workspace:update 내 watcher 재시작 | ✅     | ✅             | ⚠️     |

**Result: 98% Match**

> MINOR: 설계는 `if (data.path !== undefined)` 조건만 사용하나, 구현은 `if (data.path !== undefined && updated)` 로 `updated`에 대한 null 안전성 체크가 추가됨. 이는 설계보다 더 안전한 방향의 개선.

### 3.9 Preload Bridge (`src/preload/index.ts`)

| API Method        | Design | Implementation | Status |
| ----------------- | ------ | -------------- | ------ |
| folder.readTree   | ✅     | ✅             | ✅     |
| folder.create     | ✅     | ✅             | ✅     |
| folder.rename     | ✅     | ✅             | ✅     |
| folder.remove     | ✅     | ✅             | ✅     |
| folder.move       | ✅     | ✅             | ✅     |
| folder.updateMeta | ✅     | ✅             | ✅     |
| folder.onChanged  | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.10 Preload Types (`src/preload/index.d.ts`)

| Type                 | Design | Implementation | Status |
| -------------------- | ------ | -------------- | ------ |
| FolderNode interface | ✅     | ✅             | ✅     |
| FolderAPI interface  | ✅     | ✅             | ✅     |
| API.folder 포함      | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.11 Entity - types.ts

| Item                  | Design | Implementation | Status |
| --------------------- | ------ | -------------- | ------ |
| FolderNode 인터페이스 | ✅     | ✅             | ✅     |
| 6개 필드 일치         | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.12 Entity - queries.ts

| Hook                | Design | Implementation | Status |
| ------------------- | ------ | -------------- | ------ |
| useFolderTree       | ✅     | ✅             | ✅     |
| useCreateFolder     | ✅     | ✅             | ✅     |
| useRenameFolder     | ✅     | ✅             | ✅     |
| useRemoveFolder     | ✅     | ✅             | ✅     |
| useMoveFolder       | ✅     | ✅             | ✅     |
| useUpdateFolderMeta | ✅     | ✅             | ✅     |
| TREE_KEY = 'folder' | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.13 Entity - use-folder-watcher.ts

| Item                          | Design | Implementation | Status |
| ----------------------------- | ------ | -------------- | ------ |
| useFolderWatcher hook         | ✅     | ✅             | ✅     |
| onChanged 구독 + invalidation | ✅     | ✅             | ✅     |
| cleanup (return unsub)        | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.14 Entity - index.ts (barrel)

| Export           | Design | Implementation | Status |
| ---------------- | ------ | -------------- | ------ |
| FolderNode type  | ✅     | ✅             | ✅     |
| 6 hooks          | ✅     | ✅             | ✅     |
| useFolderWatcher | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.15 Feature - FolderTree.tsx

| Item                           | Design | Implementation | Status |
| ------------------------------ | ------ | -------------- | ------ |
| react-arborist Tree 사용       | ✅     | ✅             | ✅     |
| onCreate (null 반환)           | ✅     | ✅             | ✅     |
| onRename                       | ✅     | ✅             | ✅     |
| onMove (dragIds[0])            | ✅     | ✅             | ✅     |
| onDelete -> DeleteFolderDialog | ✅     | ✅             | ✅     |
| deleteTarget state             | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.16 Feature - FolderNodeRenderer.tsx

| Item                     | Design | Implementation | Status |
| ------------------------ | ------ | -------------- | ------ |
| Folder/FolderOpen 아이콘 | ✅     | ✅             | ✅     |
| color 반영               | ✅     | ✅             | ✅     |
| dragHandle ref           | ✅     | ✅             | ✅     |
| toggle onClick           | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.17 Feature - DeleteFolderDialog.tsx

| Item               | Design | Implementation | Status |
| ------------------ | ------ | -------------- | ------ |
| AlertDialog 구성   | ✅     | ✅             | ✅     |
| isPending 상태     | ✅     | ✅             | ✅     |
| destructive 스타일 | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.18 Feature - index.ts (barrel)

| Item              | Design | Implementation | Status |
| ----------------- | ------ | -------------- | ------ |
| FolderTree export | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.19 Page - FolderPage.tsx

| Item                      | Design | Implementation | Status |
| ------------------------- | ------ | -------------- | ------ |
| TabContainer + TabHeader  | ✅     | ✅             | ✅     |
| workspaceId 조건부 렌더링 | ✅     | ✅             | ✅     |
| FolderTree 연결           | ✅     | ✅             | ✅     |

**Result: 100% Match**

### 3.20 Layout - MainLayout.tsx

| Item                    | Design | Implementation | Status |
| ----------------------- | ------ | -------------- | ------ |
| useFolderWatcher() 호출 | ✅     | ✅             | ✅     |

**Result: 100% Match**

---

## 4. Gap List

### 4.1 Missing Features (Design O, Implementation X)

**None** -- 설계된 모든 기능이 구현되었습니다.

### 4.2 Added Features (Design X, Implementation O)

**None** -- 설계에 없는 추가 기능은 없습니다.

### 4.3 Changed Features (Design != Implementation)

| #   | Severity | Item                       | Design                                     | Implementation                                 | Impact                                 |
| --- | -------- | -------------------------- | ------------------------------------------ | ---------------------------------------------- | -------------------------------------- |
| 1   | MINOR    | `updateMeta` 파라미터명    | `workspaceId`                              | `_workspaceId`                                 | None (unused 파라미터 표시, 동작 동일) |
| 2   | MINOR    | workspace:update 조건      | `if (data.path !== undefined)`             | `if (data.path !== undefined && updated)`      | Positive (null 안전성 강화)            |
| 3   | MINOR    | `deleteOrphans` JSDoc 주석 | "readDirRecursive가 accessSync 실패 시..." | "서비스 레이어에서 미리 accessSync 체크 후..." | None (주석만 차이, 코드 동일)          |

---

## 5. Architecture Compliance

### 5.1 Layer Dependency Verification

| Layer                      | Expected                                     | Actual                                       | Status |
| -------------------------- | -------------------------------------------- | -------------------------------------------- | ------ |
| IPC (ipc/)                 | service, repository, folder-watcher          | service, repository, folder-watcher          | ✅     |
| Service (services/)        | repository, workspace-repository, lib/errors | repository, workspace-repository, lib/errors | ✅     |
| FolderWatcher (services/)  | repository, service(readDirRecursive)        | repository, service(readDirRecursive)        | ✅     |
| Repository (repositories/) | db, schema                                   | db, schema                                   | ✅     |
| Entity (entities/folder/)  | shared/lib, shared/types                     | shared/lib, shared/types                     | ✅     |
| Feature (features/folder/) | entities/folder                              | entities/folder                              | ✅     |
| Page (pages/folder/)       | features/folder, shared                      | features/folder, shared                      | ✅     |

### 5.2 Circular Dependency Prevention

| Rule                                            | Status  |
| ----------------------------------------------- | ------- |
| folder.ts -> folder-watcher.ts 금지 (순환 방지) | ✅ 준수 |
| watcher 활성화는 ipc/folder.ts에서 담당         | ✅ 준수 |

### 5.3 FSD Import Rules

| Rule                                         | Status |
| -------------------------------------------- | ------ |
| feature -> entity (하위 레이어만 참조)       | ✅     |
| page -> feature, shared (하위 레이어만 참조) | ✅     |
| entity -> shared (하위 레이어만 참조)        | ✅     |

**Architecture Score: 100%**

---

## 6. Convention Compliance

### 6.1 Naming Convention

| Category          | Convention     |                             Files                              | Compliance |
| ----------------- | -------------- | :------------------------------------------------------------: | :--------: |
| Components        | PascalCase     | FolderTree, FolderNodeRenderer, DeleteFolderDialog, FolderPage |    100%    |
| Functions/Hooks   | camelCase      |              useFolderTree, useCreateFolder, etc.              |    100%    |
| Folders           | kebab-case     |                     manage-folder, folder                      |    100%    |
| Files (component) | PascalCase.tsx |          FolderTree.tsx, FolderNodeRenderer.tsx, etc.          |    100%    |
| Files (utility)   | kebab-case.ts  |               use-folder-watcher.ts, queries.ts                |    100%    |

### 6.2 Import Order

All files follow the correct import order:

1. External libraries (react, react-arborist, @tanstack/react-query, etc.)
2. Internal absolute imports (@entities/, @shared/, @features/)
3. Relative imports (./)
4. Type imports (import type)

**Convention Score: 100%**

---

## 7. Recommended Actions

### 7.1 Optional Improvements (Non-critical)

| Priority | Item                  | File             | Description                                         |
| -------- | --------------------- | ---------------- | --------------------------------------------------- |
| Low      | 설계 문서 주석 동기화 | folder.design.md | `deleteOrphans` JSDoc 주석을 구현체와 일치시키기    |
| Low      | 설계 문서 조건 동기화 | folder.design.md | workspace:update 조건에 `&& updated` null 체크 반영 |

### 7.2 No Immediate Actions Required

설계와 구현의 일치도가 99%로 매우 높으며, 발견된 3개의 차이점은 모두 MINOR 수준입니다.

- 1건: unused 파라미터 표기 (`_workspaceId`)
- 1건: 안전성 개선 (`&& updated` 추가)
- 1건: 주석 문구 차이

어느 것도 기능적 동작에 영향을 주지 않으므로 즉시 조치는 불필요합니다.

---

## 8. Design Document Updates Needed

설계 문서를 구현에 맞추어 동기화할 경우:

- [ ] Section 3-2: `updateMeta`의 `workspaceId` -> `_workspaceId` 반영 (선택)
- [ ] Section 4 (workspace.ts): `if (data.path !== undefined && updated)` 반영 (권장)
- [ ] Section 2: `deleteOrphans` JSDoc 주석 현행화 (선택)

---

## 9. Conclusion

Folder feature의 설계-구현 Gap 분석 결과, **Match Rate 99%** 로 설계와 구현이 거의 완벽하게 일치합니다. 발견된 3건의 차이는 모두 MINOR 수준이며 기능적 영향이 없습니다. 추가 iteration 없이 Report 단계로 진행할 수 있습니다.

---

## Version History

| Version | Date       | Changes              | Author                     |
| ------- | ---------- | -------------------- | -------------------------- |
| 1.0     | 2026-02-24 | Initial gap analysis | Claude Code (gap-detector) |
