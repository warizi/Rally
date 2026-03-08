# folder-test Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: Rally
> **Analyst**: Claude (gap-detector)
> **Date**: 2026-02-26
> **Plan Doc**: [folder-test.plan.md](../01-plan/features/folder-test.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Folder 기능의 미작성 테스트 코드에 대한 Plan 문서와 실제 구현 간의 일치율을 검증한다.

### 1.2 Analysis Scope

- **Plan Document**: `docs/01-plan/features/folder-test.plan.md`
- **Implementation Files**:
  - `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` (MODIFY)
  - `src/renderer/src/features/folder/manage-folder/model/__tests__/use-workspace-tree.test.ts` (NEW)
  - `src/renderer/src/features/folder/manage-folder/model/__tests__/use-tree-open-state.test.ts` (NEW)
  - `src/renderer/src/entities/folder/model/__tests__/use-folder-watcher.test.ts` (NEW)
- **Analysis Date**: 2026-02-26

---

## 2. Gap Analysis (Plan vs Implementation)

### 2.1 buildWorkspaceTree export 추가

| Plan                                           | Implementation                                                          | Status   |
| ---------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| `export function buildWorkspaceTree(...)` 추가 | `use-workspace-tree.ts:16` -- `export function buildWorkspaceTree(...)` | ✅ Match |

### 2.2 buildWorkspaceTree 테스트 케이스

| Plan Test Case                                           | Implementation                       | Status   |
| -------------------------------------------------------- | ------------------------------------ | -------- |
| 빈 입력 `([], [])` -> `[]`                               | `use-workspace-tree.test.ts:32-34`   | ✅ Match |
| 중첩 폴더 재귀 변환 + children 유지                      | `use-workspace-tree.test.ts:56-76`   | ✅ Match |
| 폴더 출력 toEqual 전체 필드 검증                         | `use-workspace-tree.test.ts:39-54`   | ✅ Match |
| `folderId===null` 노트 루트 레벨 NoteTreeNode 변환       | `use-workspace-tree.test.ts:81-106`  | ✅ Match |
| `NoteNode.title` -> `NoteTreeNode.name` 매핑 검증        | `use-workspace-tree.test.ts:108-112` | ✅ Match |
| 노트 출력 toEqual 전체 필드 검증                         | `use-workspace-tree.test.ts:81-106`  | ✅ Match |
| 폴더 children 끝에 해당 folderId 노트 추가               | `use-workspace-tree.test.ts:117-127` | ✅ Match |
| `folderId===null` 루트 노트는 루트 폴더 뒤               | `use-workspace-tree.test.ts:129-138` | ✅ Match |
| 존재하지 않는 folderId 노트 drop                         | `use-workspace-tree.test.ts:140-149` | ✅ Match |
| 크로스 타입 정렬: 하위폴더(order:10) > 하위노트(order:0) | `use-workspace-tree.test.ts:154-167` | ✅ Match |
| 크로스 타입 정렬: 루트 레벨 폴더 > 노트                  | `use-workspace-tree.test.ts:169-177` | ✅ Match |
| within-kind: 루트 폴더 order 오름차순                    | `use-workspace-tree.test.ts:182-189` | ✅ Match |
| within-kind: 루트 폴더 같은 order 이름 알파벳순          | `use-workspace-tree.test.ts:192-200` | ✅ Match |
| within-kind: 루트 노트 order 오름차순                    | `use-workspace-tree.test.ts:202-209` | ✅ Match |
| within-kind: 루트 노트 같은 order title 알파벳순         | `use-workspace-tree.test.ts:212-220` | ✅ Match |
| within-kind: 중첩 폴더 children 동일 규칙                | `use-workspace-tree.test.ts:222-233` | ✅ Match |

**결과: 16/16 케이스 전체 커버 (100%)**

### 2.3 useTreeOpenState 테스트 케이스

| Plan Test Case                                       | Implementation                      | Status   |
| ---------------------------------------------------- | ----------------------------------- | -------- |
| localStorage 값 없으면 `openState = {}`              | `use-tree-open-state.test.ts:14-17` | ✅ Match |
| localStorage 저장된 값 파싱 반환                     | `use-tree-open-state.test.ts:19-23` | ✅ Match |
| `getItem` throw -> `{}` 반환                         | `use-tree-open-state.test.ts:25-31` | ✅ Match |
| malformed JSON -> `{}` 반환                          | `use-tree-open-state.test.ts:33-37` | ✅ Match |
| `toggle('f1', true)` -> `openState['f1'] === true`   | `use-tree-open-state.test.ts:42-45` | ✅ Match |
| `toggle('f1', false)` -> `openState['f1'] === false` | `use-tree-open-state.test.ts:48-52` | ✅ Match |
| toggle 후 `localStorage.setItem` 호출                | `use-tree-open-state.test.ts:54-58` | ✅ Match |
| `setItem` throw해도 에러 없이 처리                   | `use-tree-open-state.test.ts:61-69` | ✅ Match |
| key 형식 `folder-tree-open-state-{workspaceId}`      | `use-tree-open-state.test.ts:74-78` | ✅ Match |
| ws-1, ws-2 독립 key 격리 검증                        | `use-tree-open-state.test.ts:81-89` | ✅ Match |

**결과: 10/10 케이스 전체 커버 (100%)**

### 2.4 useFolderWatcher 테스트 케이스

| Plan Test Case                               | Implementation                     | Status   |
| -------------------------------------------- | ---------------------------------- | -------- |
| 마운트 시 `onChanged` 1회 호출               | `use-folder-watcher.test.ts:43-47` | ✅ Match |
| `onChanged` 콜백 -> `invalidateQueries` 호출 | `use-folder-watcher.test.ts:52-61` | ✅ Match |
| 언마운트 시 unsubscribe 호출                 | `use-folder-watcher.test.ts:66-73` | ✅ Match |

**결과: 3/3 케이스 전체 커버 (100%)**

### 2.5 Mock 전략 검증

| Plan Mock Strategy                                               | Implementation                       | Status   |
| ---------------------------------------------------------------- | ------------------------------------ | -------- |
| `buildWorkspaceTree` 직접 import, React 불필요                   | 순수 함수 import + 직접 호출         | ✅ Match |
| `useTreeOpenState`: happy-dom localStorage + `beforeEach clear`  | `localStorage.clear()` in beforeEach | ✅ Match |
| `useFolderWatcher`: `capturedCb` 패턴 + `mockUnsubscribe`        | 동일 패턴 사용 (`test.ts:23-28`)     | ✅ Match |
| `useFolderWatcher`: `vi.spyOn(queryClient, 'invalidateQueries')` | 동일 (`test.ts:54`)                  | ✅ Match |
| `useFolderWatcher`: `QueryClientProvider` wrapper                | `createWrapper()` helper 사용        | ✅ Match |

**결과: 5/5 전략 일치 (100%)**

### 2.6 파일 구조 검증

| Plan Path                                                                         | Actual              | Status   |
| --------------------------------------------------------------------------------- | ------------------- | -------- |
| `features/folder/manage-folder/model/use-workspace-tree.ts` (MODIFY)              | 존재, export 추가됨 | ✅ Match |
| `features/folder/manage-folder/model/__tests__/use-workspace-tree.test.ts` (NEW)  | 존재                | ✅ Match |
| `features/folder/manage-folder/model/__tests__/use-tree-open-state.test.ts` (NEW) | 존재                | ✅ Match |
| `entities/folder/model/__tests__/use-folder-watcher.test.ts` (NEW)                | 존재                | ✅ Match |

**결과: 4/4 파일 일치 (100%)**

### 2.7 Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100%                    |
+---------------------------------------------+
|  buildWorkspaceTree export:  1/1   (100%)    |
|  buildWorkspaceTree tests:  16/16  (100%)    |
|  useTreeOpenState tests:    10/10  (100%)    |
|  useFolderWatcher tests:     3/3   (100%)    |
|  Mock strategy:              5/5   (100%)    |
|  File structure:             4/4   (100%)    |
+---------------------------------------------+
|  Total:  39/39 items matched                 |
+---------------------------------------------+
```

---

## 3. Code Quality Analysis

### 3.1 Test Code Quality

| File                          | Aspect          | Assessment | Notes                                                            |
| ----------------------------- | --------------- | ---------- | ---------------------------------------------------------------- |
| `use-workspace-tree.test.ts`  | Fixture helpers | Good       | `makeFolder`, `makeNote` 헬퍼로 중복 최소화                      |
| `use-workspace-tree.test.ts`  | describe 그룹핑 | Good       | Plan의 카테고리와 1:1 대응                                       |
| `use-tree-open-state.test.ts` | 격리            | Good       | `beforeEach`에서 `localStorage.clear()` + `vi.restoreAllMocks()` |
| `use-tree-open-state.test.ts` | KEY 헬퍼        | Good       | 상수 함수로 key 형식 중복 제거                                   |
| `use-folder-watcher.test.ts`  | createWrapper   | Good       | `queryClient` + `wrapper` 함께 반환하는 패턴                     |
| `use-folder-watcher.test.ts`  | API mock 정리   | Good       | `afterEach`에서 `delete window.api`                              |

### 3.2 Minor Observations

| Type                    | File                         | Location                   | Description                                                                                | Severity                           |
| ----------------------- | ---------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| `@ts-expect-error` 사용 | `use-workspace-tree.test.ts` | L64,66,123,125,147,163,229 | `WorkspaceTreeNode` union 타입에서 children 접근 시 타입 가드 대신 `@ts-expect-error` 사용 | Info (테스트 코드이므로 수용 가능) |

---

## 4. Convention Compliance

### 4.1 Naming Convention

| Category         | Convention           | Checked | Compliance | Violations |
| ---------------- | -------------------- | :-----: | :--------: | ---------- |
| Test files       | `kebab-case.test.ts` | 3 files |    100%    | -          |
| Test folder      | `__tests__/`         | 2 dirs  |    100%    | -          |
| Helper functions | `camelCase`          |  5 fns  |    100%    | -          |

### 4.2 Import Order

All 3 test files follow the correct import order:

1. External libraries (`vitest`, `@testing-library/react`, `@tanstack/react-query`)
2. Internal absolute imports (`@entities/folder`, `@entities/note`)
3. Relative imports (`../use-workspace-tree`)

### 4.3 FSD Compliance

| Rule                             | Status | Notes                                                                              |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Test files colocated with source | ✅     | `__tests__/` in same `model/` directory                                            |
| No upward layer imports in tests | ✅     | Tests import only from same layer or below                                         |
| Entity test in entity layer      | ✅     | `useFolderWatcher` test in `entities/folder/model/`                                |
| Feature test in feature layer    | ✅     | `buildWorkspaceTree`, `useTreeOpenState` in `features/folder/manage-folder/model/` |

---

## 5. Success Criteria Verification

| Criterion                                                                      | Status | Evidence                                                                |
| ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------- |
| `buildWorkspaceTree` export 추가                                               | ✅     | `use-workspace-tree.ts:16` -- `export function buildWorkspaceTree(...)` |
| `buildWorkspaceTree`: 빈 입력, 폴더만, 노트만, 혼합, 정렬, 필드 매핑 전체 커버 | ✅     | 16/16 테스트 케이스 구현                                                |
| `useTreeOpenState`: localStorage 읽기/쓰기/예외처리 커버                       | ✅     | 10/10 테스트 케이스 구현                                                |
| `useFolderWatcher`: 구독 등록, 이벤트->invalidation, 언마운트 cleanup 커버     | ✅     | 3/3 테스트 케이스 구현                                                  |
| `npm run typecheck` 에러 없음                                                  | --     | 별도 실행 필요                                                          |
| `npm run test` 전체 통과                                                       | --     | 별도 실행 필요                                                          |

---

## 6. Overall Score

```
+---------------------------------------------+
|  Overall Score: 100/100                      |
+---------------------------------------------+
|  Design Match (Plan):    100%  (39/39)       |
|  Code Quality:           95%   (minor: ts-expect-error) |
|  Convention Compliance:  100%                |
|  FSD Architecture:       100%                |
+---------------------------------------------+
|  Match Rate:  100%                           |
+---------------------------------------------+
```

---

## 7. Recommended Actions

### 7.1 Immediate (Required)

| Priority | Item                     | Notes                        |
| -------- | ------------------------ | ---------------------------- |
| 1        | `npm run typecheck` 실행 | Success Criteria 미검증 항목 |
| 2        | `npm run test` 실행      | Success Criteria 미검증 항목 |

### 7.2 Optional Improvements

| Item                            | File                         | Notes                                                                                   |
| ------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `@ts-expect-error` -> 타입 가드 | `use-workspace-tree.test.ts` | `if ('children' in node)` 가드로 대체 가능하나, 테스트 코드이므로 현재 방식도 수용 가능 |

---

## 8. Next Steps

- [ ] `npm run typecheck` 통과 확인
- [ ] `npm run test` 통과 확인
- [ ] 통과 시 completion report 작성 (`/pdca report folder-test`)

---

## Version History

| Version | Date       | Changes          | Author                |
| ------- | ---------- | ---------------- | --------------------- |
| 1.0     | 2026-02-26 | Initial analysis | Claude (gap-detector) |
