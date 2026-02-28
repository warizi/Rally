# csv-test Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: Rally
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-03-01
> **Plan Doc**: [csv-test.plan.md](../01-plan/features/csv-test.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

CSV 파일 관리 기능의 테스트 코드 작성 Plan 문서와 실제 구현된 테스트 코드 간의 1:1 Gap 분석을 수행한다.

### 1.2 Analysis Scope

- **Plan Document**: `docs/01-plan/features/csv-test.plan.md`
- **Implementation Files**:
  - `src/main/repositories/__tests__/csv-file.test.ts` (Repository 테스트)
  - `src/main/services/__tests__/csv-file.test.ts` (Service 테스트)
- **Analysis Date**: 2026-03-01

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | ✅ |
| Architecture Compliance | 100% | ✅ |
| Convention Compliance | 100% | ✅ |
| **Overall** | **100%** | ✅ |

---

## 3. Gap Analysis (Plan vs Implementation)

### 3.1 Test File Structure

| Plan | Implementation | Status |
|------|---------------|--------|
| `src/main/repositories/__tests__/csv-file.test.ts` | 존재 (201 lines) | ✅ Match |
| `src/main/services/__tests__/csv-file.test.ts` | 존재 (362 lines) | ✅ Match |

### 3.2 Environment / Setup

| Plan Item | Implementation | Status |
|-----------|---------------|--------|
| `globals: false` -- `describe`, `it`, `expect`, `vi`, `beforeEach` 명시적 import | Repository: `import { describe, expect, it, beforeEach } from 'vitest'` | ✅ Match |
| | Service: `import { describe, expect, it, vi, beforeEach } from 'vitest'` | ✅ Match |
| Repository: testDb (in-memory SQLite) 사용 | `import { testDb } from '../../__tests__/setup'` | ✅ Match |
| `csvFiles.workspaceId -> workspaces.id (onDelete: cascade)` -- setup.ts 수정 불필요 | setup.ts 미수정, workspace insert로 FK 만족 | ✅ Match |

### 3.3 Fixture / Mock Structure

#### [A] csvFileRepository -- Fixture Helper

| Plan Item | Implementation | Status |
|-----------|---------------|--------|
| `WS_ID = 'ws-1'` | `const WS_ID = 'ws-1'` (line 6) | ✅ Match |
| `beforeEach` -- workspace insert | workspace insert with id/name/path/createdAt/updatedAt (lines 8-19) | ✅ Match |
| `makeCsv(overrides?)` helper | `function makeCsv(overrides?: Partial<CsvFileInsert>)` (lines 21-35) | ✅ Match |
| makeCsv 기본값: id='csv-1', workspaceId=WS_ID, folderId=null, relativePath='test.csv', title='test', description='', preview='', order=0 | 모든 필드 일치 | ✅ Match |

#### [B] csvFileService -- Mock Structure

| Plan Mock | Implementation | Status |
|-----------|---------------|--------|
| `vi.mock('../../repositories/workspace')` | lines 13-15 | ✅ Match |
| `vi.mock('../../repositories/csv-file')` -- 8 methods | lines 17-28 (findByWorkspaceId, findById, findByRelativePath, create, createMany, update, deleteOrphans, delete) | ✅ Match |
| `vi.mock('../../repositories/folder')` -- findById, findByRelativePath | lines 30-32 | ✅ Match |
| `vi.mock('fs')` | line 34 | ✅ Match |
| `vi.mock('chardet')` | line 35 | ✅ Match |
| `vi.mock('iconv-lite')` | line 36 | ✅ Match |
| `vi.mock('nanoid')` -- `() => 'mock-id'` | line 37 | ✅ Match |
| `vi.mock('../../lib/fs-utils')` -- resolveNameConflict, readCsvFilesRecursive | lines 38-41 | ✅ Match |
| `vi.mock('../../lib/leaf-reindex')` -- getLeafSiblings, reindexLeafSiblings | lines 42-45 | ✅ Match |

---

## 4. Test Case 1:1 Comparison

### 4.1 [A] csvFileRepository (21 cases)

#### findByWorkspaceId (2/2)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | csv 없을 때 빈 배열 반환 | `it('csv 없을 때 빈 배열 반환', ...)` (L38-40) | ✅ |
| 2 | 해당 workspace의 csv만 반환 (다른 ws 제외) | `it('해당 workspace의 csv만 반환 (다른 ws 제외)', ...)` (L42-52) | ✅ |

#### findById (2/2)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 존재하는 id -> CsvFile 반환 | `it('존재하는 id -> CsvFile 반환', ...)` (L56-58) | ✅ |
| 2 | 없는 id -> undefined | `it('없는 id -> undefined', ...)` (L60-62) | ✅ |

#### findByRelativePath (2/2)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | workspaceId + relativePath 일치 -> CsvFile 반환 | `it('workspaceId + relativePath 일치 -> CsvFile 반환', ...)` (L66-71) | ✅ |
| 2 | 일치 없음 -> undefined | `it('일치 없음 -> undefined', ...)` (L72-74) | ✅ |

#### create (1/1)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 모든 필드 포함하여 생성 후 반환 | `it('모든 필드 포함하여 생성 후 반환', ...)` (L78-84) | ✅ |

#### createMany (3/3)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 빈 배열 -> no-op | `it('빈 배열 -> no-op', ...)` (L88-91) | ✅ |
| 2 | 여러 건 삽입 후 findByWorkspaceId로 확인 | `it('여러 건 삽입 후 findByWorkspaceId로 확인', ...)` (L93-99) | ✅ |
| 3 | 중복 relativePath -> onConflictDoNothing (에러 없음) | `it('중복 relativePath -> onConflictDoNothing (에러 없음)', ...)` (L101-109) | ✅ |

#### update (2/2)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 지정 필드만 변경, 나머지 보존 | `it('지정 필드만 변경, 나머지 보존', ...)` (L113-118) | ✅ |
| 2 | 없는 id -> undefined | `it('없는 id -> undefined', ...)` (L119-121) | ✅ |

#### deleteOrphans (3/3)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | existingPaths에 없는 csv 삭제 | `it('existingPaths에 없는 csv 삭제', ...)` (L125-131) | ✅ |
| 2 | existingPaths 빈 배열 -> 전체 삭제 | `it('existingPaths 빈 배열 -> 전체 삭제', ...)` (L133-138) | ✅ |
| 3 | 모두 existingPaths에 있으면 삭제 없음 | `it('모두 existingPaths에 있으면 삭제 없음', ...)` (L140-145) | ✅ |

#### bulkDeleteByPrefix (1/1)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | prefix 일치하는 csv만 삭제, 나머지 보존 | `it('prefix 하위 csv만 삭제, 나머지 보존', ...)` (L149-157) | ✅ |

#### bulkUpdatePathPrefix (3/3)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정확히 oldPrefix와 일치하는 경로 -> newPrefix로 변경 | `it('정확히 oldPrefix와 일치하는 경로 -> newPrefix로 변경', ...)` (L161-164) | ✅ |
| 2 | oldPrefix/ 하위 경로 -> newPrefix/ 하위로 변경 | `it('oldPrefix/ 하위 경로 -> newPrefix/ 하위로 변경', ...)` (L167-173) | ✅ |
| 3 | updatedAt 갱신 확인 | `it('updatedAt 갱신 확인', ...)` (L175-181) | ✅ |

#### reindexSiblings (1/1)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | orderedIds 순서대로 order 재설정 | `it('orderedIds 순서대로 order 재설정', ...)` (L185-191) | ✅ |

#### delete (1/1)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 삭제 후 findById -> undefined | `it('삭제 후 findById -> undefined', ...)` (L195-199) | ✅ |

**Repository Subtotal: 21/21 (100%)**

---

### 4.2 [B] csvFileService (34 cases)

#### readByWorkspaceFromDb (2/2)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정상 -- repository 호출 후 CsvFileNode[] 반환 | `it('정상 -- repository 호출 후 CsvFileNode[] 반환', ...)` (L85-90) | ✅ |
| 2 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L92-95) | ✅ |

#### create (5/5)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정상 생성 -- fs.writeFileSync + repository.create 호출 | `it('정상 생성 -- fs.writeFileSync + repository.create 호출', ...)` (L101-107) | ✅ |
| 2 | folderId 지정 -- folderRepository.findById 호출 | `it('folderId 지정 -- folderRepository.findById 호출', ...)` (L109-116) | ✅ |
| 3 | 빈 문자열 name -> 기본 이름 '새로운 테이블' 사용 | `it("빈 문자열 name -> 기본 이름 '새로운 테이블' 사용", ...)` (L118-123) | ✅ |
| 4 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L125-128) | ✅ |
| 5 | 없는 folderId -> NotFoundError | `it('없는 folderId -> NotFoundError', ...)` (L130-133) | ✅ |

#### rename (4/4)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정상 이름 변경 -- fs.renameSync + repository.update 호출 | `it('정상 이름 변경 -- fs.renameSync + repository.update 호출', ...)` (L139-146) | ✅ |
| 2 | 동일 이름 (trim 후 비교) -> 변경 없이 기존 객체 반환 | `it('동일 이름 (trim 후 비교) -> 변경 없이 기존 객체 반환', ...)` (L148-153) | ✅ |
| 3 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L155-158) | ✅ |
| 4 | 없는 csvId -> NotFoundError | `it('없는 csvId -> NotFoundError', ...)` (L160-163) | ✅ |

#### remove (4/4)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정상 삭제 -- fs.unlinkSync + repository.delete 호출 | `it('정상 삭제 -- fs.unlinkSync + repository.delete 호출', ...)` (L169-173) | ✅ |
| 2 | 외부 삭제 (fs 에러) -- repository.delete만 호출 (에러 무시) | `it('외부 삭제 (fs 에러) -- repository.delete만 호출 (에러 무시)', ...)` (L175-181) | ✅ |
| 3 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L183-186) | ✅ |
| 4 | 없는 csvId -> NotFoundError | `it('없는 csvId -> NotFoundError', ...)` (L188-191) | ✅ |

#### readContent (7/7)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정상 -- 인코딩 감지 + iconv 디코딩 | `it('정상 -- 인코딩 감지 + iconv 디코딩', ...)` (L197-209) | ✅ |
| 2 | 빈 파일 (length=0) -> content='', encoding='UTF-8' 반환 | `it("빈 파일 (length=0) -> content='', encoding='UTF-8' 반환", ...)` (L211-217) | ✅ |
| 3 | BOM 포함 파일 -> BOM 제거 | `it('BOM 포함 파일 -> BOM 제거', ...)` (L219-227) | ✅ |
| 4 | chardet.detect -> null 반환 시 UTF-8 폴백 | `it('chardet.detect -> null 반환 시 UTF-8 폴백', ...)` (L229-238) | ✅ |
| 5 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L240-243) | ✅ |
| 6 | 없는 csvId -> NotFoundError | `it('없는 csvId -> NotFoundError', ...)` (L245-248) | ✅ |
| 7 | 파일 읽기 실패 (fs.readFileSync throw) -> NotFoundError | `it('파일 읽기 실패 (fs.readFileSync throw) -> NotFoundError', ...)` (L250-255) | ✅ |

#### writeContent (3/3)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 정상 -- fs.writeFileSync + preview 업데이트 (첫 3줄, 200자 제한) | `it('정상 -- fs.writeFileSync + preview 업데이트 (첫 3줄, 200자 제한)', ...)` (L261-269) | ✅ |
| 2 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L271-274) | ✅ |
| 3 | 없는 csvId -> NotFoundError | `it('없는 csvId -> NotFoundError', ...)` (L276-279) | ✅ |

#### move (5/5)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | 같은 폴더 이동 -- fs.renameSync 미호출, reindexLeafSiblings만 호출 | `it('같은 폴더 이동 -- fs.renameSync 미호출, reindexLeafSiblings만 호출', ...)` (L285-291) | ✅ |
| 2 | 다른 폴더 이동 -- fs.renameSync + repository.update + reindexLeafSiblings 호출 | `it('다른 폴더 이동 -- fs.renameSync + repository.update + reindexLeafSiblings 호출', ...)` (L293-302) | ✅ |
| 3 | 없는 workspaceId -> NotFoundError | `it('없는 workspaceId -> NotFoundError', ...)` (L304-307) | ✅ |
| 4 | 없는 csvId -> NotFoundError | `it('없는 csvId -> NotFoundError', ...)` (L309-312) | ✅ |
| 5 | 없는 targetFolderId -> NotFoundError | `it('없는 targetFolderId -> NotFoundError', ...)` (L314-317) | ✅ |

#### updateMeta (3/3)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | description 업데이트 -- repository.update 호출 | `it('description 업데이트 -- repository.update 호출', ...)` (L323-329) | ✅ |
| 2 | columnWidths 업데이트 -- repository.update 호출 | `it('columnWidths 업데이트 -- repository.update 호출', ...)` (L331-337) | ✅ |
| 3 | 없는 csvId -> NotFoundError | `it('없는 csvId -> NotFoundError', ...)` (L339-344) | ✅ |

#### toCsvFileNode Date 변환 (1/1)

| # | Plan | Implementation (line) | Status |
|---|------|----------------------|--------|
| 1 | createdAt/updatedAt number -> Date 인스턴스 변환 확인 | `it('createdAt/updatedAt number -> Date 인스턴스 변환 확인', ...)` (L350-360) | ✅ |

**Service Subtotal: 34/34 (100%)**

---

## 5. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100% (55/55)            |
+---------------------------------------------+
|  [A] csvFileRepository:  21/21  (100%)       |
|  [B] csvFileService:     34/34  (100%)       |
+---------------------------------------------+
|  Missing (Plan O, Impl X):    0 items        |
|  Added   (Plan X, Impl O):    0 items        |
|  Changed (Plan != Impl):      0 items        |
+---------------------------------------------+
```

---

## 6. Differences Found

### Missing Features (Plan O, Implementation X)

None.

### Added Features (Plan X, Implementation O)

None.

### Changed Features (Plan != Implementation)

None.

---

## 7. Convention Compliance

### 7.1 Naming Convention

| Category | Convention | Status |
|----------|-----------|--------|
| Test files | `__tests__/csv-file.test.ts` (kebab-case) | ✅ |
| Constants | `WS_ID`, `MOCK_WS`, `MOCK_CSV_ROW`, `MOCK_FOLDER` (UPPER_SNAKE_CASE) | ✅ |
| Functions | `makeCsv` (camelCase) | ✅ |
| describe blocks | Method name matching (camelCase) | ✅ |

### 7.2 Import Order

| File | Order | Status |
|------|-------|--------|
| csv-file.test.ts (repository) | vitest -> setup -> schema -> repository | ✅ |
| csv-file.test.ts (service) | vitest -> fs/chardet/iconv (external) -> service -> repositories -> lib | ✅ |

### 7.3 Test Pattern Compliance

| Pattern | Repository | Service |
|---------|-----------|---------|
| Explicit vitest imports (globals: false) | ✅ | ✅ |
| `beforeEach` reset/setup | ✅ (workspace insert) | ✅ (vi.clearAllMocks + default mocks) |
| Fixture helper (`makeCsv`) | ✅ | N/A (uses MOCK constants) |
| vi.mock for all external deps | N/A | ✅ (9 mock targets) |
| vi.mocked for type-safe mock manipulation | N/A | ✅ |

---

## 8. Architecture Compliance

| Layer | File | Expected Location | Actual Location | Status |
|-------|------|-------------------|-----------------|--------|
| Repository Test | csv-file.test.ts | `src/main/repositories/__tests__/` | `src/main/repositories/__tests__/` | ✅ |
| Service Test | csv-file.test.ts | `src/main/services/__tests__/` | `src/main/services/__tests__/` | ✅ |

Dependency direction: Service tests mock repository layer (correct: Application -> Domain). Repository tests use in-memory DB directly (correct: Infrastructure test).

---

## 9. Overall Score

```
+---------------------------------------------+
|  Overall Score: 100/100                      |
+---------------------------------------------+
|  Design Match:        100%                   |
|  Convention:          100%                   |
|  Architecture:        100%                   |
+---------------------------------------------+
```

---

## 10. Recommended Actions

No actions required. Plan and implementation are in perfect alignment.

### Notes

- Plan Section 6 explicitly excludes `readByWorkspace` (full fs scan + lazy upsert + move detection) due to branch complexity. This is intentional and does not count as a gap.
- `bulkUpdatePathPrefix` and `bulkDeleteByPrefix` use raw SQL as noted in Plan Section 6 and are properly tested via direct DB verification in the repository tests.

---

## 11. Related Documents

- Plan: [csv-test.plan.md](../01-plan/features/csv-test.plan.md)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-01 | Initial analysis -- 100% match (55/55 cases) | Claude Code (gap-detector) |
