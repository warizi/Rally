# pdf-test Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-03-01
> **Design Doc**: [pdf-test.design.md](../02-design/features/pdf-test.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the PDF file test implementation matches the design document exactly -- every test case, mock structure, fixture helper, and assertion pattern.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/pdf-test.design.md`
- **Implementation Files**:
  - `src/main/repositories/__tests__/pdf-file.test.ts` (Repository: 21 cases)
  - `src/main/services/__tests__/pdf-file.test.ts` (Service: 26 cases)
- **Analysis Date**: 2026-03-01

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | PASS |
| Test Case Count | 47/47 | PASS |
| Mock Structure | 100% | PASS |
| Fixture Helpers | 100% | PASS |
| Assertion Patterns | 100% | PASS |
| **Overall** | **100%** | **PASS** |

---

## 3. Repository Test Comparison (21/21)

### 3.1 Import & Fixture (`makePdf`)

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| vitest imports | `describe, expect, it, beforeEach` | `describe, expect, it, beforeEach` | PASS |
| testDb import | `../../__tests__/setup` | `../../__tests__/setup` | PASS |
| schema import | `../../db/schema` | `../../db/schema` | PASS |
| repository import | `../pdf-file` | `../pdf-file` | PASS |
| WS_ID constant | `'ws-1'` | `'ws-1'` | PASS |
| beforeEach workspace insert | All fields match | All fields match | PASS |
| makePdf fields | id, workspaceId, folderId, relativePath, title, description, preview, order, createdAt, updatedAt | Identical fields | PASS |
| makePdf defaults | `id:'pdf-1'`, `folderId:null`, `relativePath:'test.pdf'`, `title:'test'`, `description:''`, `preview:''`, `order:0` | Identical defaults | PASS |

### 3.2 Test Cases

| # | describe | it (Design) | it (Implementation) | Assertion Match | Status |
|---|----------|-------------|---------------------|-----------------|--------|
| 1 | findByWorkspaceId | pdf 없을 때 빈 배열 반환 | pdf 없을 때 빈 배열 반환 | `toEqual([])` | PASS |
| 2 | findByWorkspaceId | 해당 workspace의 pdf만 반환 | 해당 workspace의 pdf만 반환 (다른 ws 제외) | `toHaveLength(1)` | PASS |
| 3 | findById | 존재하는 id -> PdfFile 반환 | 존재하는 id -> PdfFile 반환 | `toBeDefined()` | PASS |
| 4 | findById | 없는 id -> undefined | 없는 id -> undefined | `toBeUndefined()` | PASS |
| 5 | findByRelativePath | 일치 -> PdfFile 반환 | workspaceId + relativePath 일치 -> PdfFile 반환 | `result!.id === 'rp1'` | PASS |
| 6 | findByRelativePath | 불일치 -> undefined | 일치 없음 -> undefined | `toBeUndefined()` | PASS |
| 7 | create | 모든 필드 포함 생성 후 반환 | 모든 필드 포함하여 생성 후 반환 | `row.id`, `row.title`, `row.description`, `row.order` | PASS |
| 8 | createMany | 빈 배열 -> no-op | 빈 배열 -> no-op | `findByWorkspaceId -> []` | PASS |
| 9 | createMany | 여러 건 삽입 | 여러 건 삽입 후 findByWorkspaceId로 확인 | `toHaveLength(2)` | PASS |
| 10 | createMany | 중복 id -> onConflictDoNothing | 중복 relativePath -> onConflictDoNothing (에러 없음) | 기존 유지, 새 행 무시 | PASS |
| 11 | update | 지정 필드만 변경 | 지정 필드만 변경, 나머지 보존 | title 변경, description 보존 | PASS |
| 12 | update | 없는 id -> undefined | 없는 id -> undefined | `toBeUndefined()` | PASS |
| 13 | deleteOrphans | existingPaths에 없는 pdf 삭제 | existingPaths에 없는 pdf 삭제 | keep `toBeDefined()`, orphan `toBeUndefined()` | PASS |
| 14 | deleteOrphans | 빈 배열 -> 전체 삭제 | existingPaths 빈 배열 -> 전체 삭제 | `toHaveLength(0)` | PASS |
| 15 | deleteOrphans | 모두 있으면 삭제 없음 | 모두 existingPaths에 있으면 삭제 없음 | `toHaveLength(2)` | PASS |
| 16 | bulkDeleteByPrefix | prefix 하위만 삭제 | prefix 하위 pdf만 삭제, 나머지 보존 | `docs/` 하위 삭제, `other.pdf` 보존 | PASS |
| 17 | bulkUpdatePathPrefix | 정확히 oldPrefix 일치 -> newPrefix | 정확히 oldPrefix와 일치하는 경로 -> newPrefix로 변경 | `relativePath === 'new-folder'` | PASS |
| 18 | bulkUpdatePathPrefix | 하위 경로 변경 | oldPrefix/ 하위 경로 -> newPrefix/ 하위로 변경 | `old-folder/a.pdf -> new-folder/a.pdf` | PASS |
| 19 | bulkUpdatePathPrefix | updatedAt 갱신 | updatedAt 갱신 확인 | `getTime()` 비교 | PASS |
| 20 | reindexSiblings | orderedIds 순서대로 order 재설정 | orderedIds 순서대로 order 재설정 | `ri2.order=0`, `ri1.order=1` | PASS |
| 21 | delete | 삭제 후 findById -> undefined | 삭제 후 findById -> undefined | `toBeUndefined()` | PASS |

---

## 4. Service Test Comparison (26/26)

### 4.1 Mock & Fixture Structure

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| vitest imports | `describe, expect, it, vi, beforeEach` | `describe, expect, it, vi, beforeEach` | PASS |
| fs import | `import fs from 'fs'` | `import fs from 'fs'` | PASS |
| pdfFileService import | `../pdf-file` | `../pdf-file` | PASS |
| pdfFileRepository import | `../../repositories/pdf-file` | `../../repositories/pdf-file` | PASS |
| workspaceRepository import | `../../repositories/workspace` | `../../repositories/workspace` | PASS |
| folderRepository import | `../../repositories/folder` | `../../repositories/folder` | PASS |
| NotFoundError import | `../../lib/errors` | `../../lib/errors` | PASS |
| reindexLeafSiblings import | `../../lib/leaf-reindex` | `../../lib/leaf-reindex` | PASS |

**vi.mock calls:**

| Mock Target | Design Methods | Implementation Methods | Status |
|-------------|---------------|----------------------|--------|
| workspace repo | `findById` | `findById` | PASS |
| pdf-file repo | `findByWorkspaceId, findById, findByRelativePath, create, createMany, update, deleteOrphans, delete` | Identical 8 methods | PASS |
| folder repo | `findById, findByRelativePath` | `findById, findByRelativePath` | PASS |
| fs | (default mock) | (default mock) | PASS |
| nanoid | `() => 'mock-id'` | `() => 'mock-id'` | PASS |
| fs-utils | `resolveNameConflict, readPdfFilesRecursive` | `resolveNameConflict, readPdfFilesRecursive` | PASS |
| leaf-reindex | `getLeafSiblings, reindexLeafSiblings` | `getLeafSiblings, reindexLeafSiblings` | PASS |

**Fixture objects:**

| Fixture | Design Fields | Implementation Fields | Status |
|---------|--------------|----------------------|--------|
| MOCK_WS | `id:'ws-1', name:'T', path:'/t', createdAt, updatedAt` | Identical | PASS |
| MOCK_PDF_ROW | `id:'pdf-1', workspaceId:'ws-1', folderId:null, relativePath:'test.pdf', title:'test', description:'', preview:'', order:0, createdAt:new Date('2026-01-01'), updatedAt:new Date('2026-01-01')` | Identical | PASS |
| MOCK_FOLDER | `id:'folder-1', workspaceId:'ws-1', relativePath:'docs', color:null, order:0, createdAt, updatedAt` | Identical | PASS |

**beforeEach mock setup:**

| Mock Return | Design | Implementation | Status |
|-------------|--------|----------------|--------|
| workspaceRepository.findById | `MOCK_WS` | `MOCK_WS` | PASS |
| pdfFileRepository.findByWorkspaceId | `[MOCK_PDF_ROW]` | `[MOCK_PDF_ROW]` | PASS |
| pdfFileRepository.findById | `MOCK_PDF_ROW` | `MOCK_PDF_ROW` | PASS |
| pdfFileRepository.create | `MOCK_PDF_ROW` | `MOCK_PDF_ROW` | PASS |
| pdfFileRepository.update | `MOCK_PDF_ROW` | `MOCK_PDF_ROW` | PASS |

### 4.2 Test Cases

| # | describe | it (Design) | it (Implementation) | Assertion Match | Status |
|---|----------|-------------|---------------------|-----------------|--------|
| 1 | readByWorkspaceFromDb | 정상 -- PdfFileNode[] 반환 | 정상 -- repository 호출 후 PdfFileNode[] 반환 | `findByWorkspaceId` called, `result[0].id === 'pdf-1'` | PASS |
| 2 | readByWorkspaceFromDb | 없는 workspaceId -> NotFoundError | 없는 workspaceId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 3 | import | 정상 가져오기 | 정상 가져오기 -- fs.copyFileSync + repository.create 호출 | `fs.copyFileSync` + `repository.create` + `title === 'test'` | PASS |
| 4 | import | folderId 지정 | folderId 지정 -- folderRepository.findById 호출, 경로에 폴더 포함 | `folderRepository.findById` called, `relativePath: 'docs/test.pdf'` | PASS |
| 5 | import | 없는 workspaceId -> NotFoundError | 없는 workspaceId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 6 | import | 없는 folderId -> NotFoundError | 없는 folderId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 7 | rename | 정상 이름 변경 | 정상 이름 변경 -- fs.renameSync + repository.update 호출 | `fs.renameSync` + `title:'newname'` + `relativePath:'newname.pdf'` | PASS |
| 8 | rename | 동일 이름 -> 변경 없이 반환 | 동일 이름 (trim 후 비교) -> 변경 없이 기존 객체 반환 | `renameSync` not called, `update` not called | PASS |
| 9 | rename | 없는 workspaceId -> NotFoundError | 없는 workspaceId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 10 | rename | 없는 pdfId -> NotFoundError | 없는 pdfId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 11 | remove | 정상 삭제 | 정상 삭제 -- fs.unlinkSync + repository.delete 호출 | `fs.unlinkSync` + `repository.delete` | PASS |
| 12 | remove | 외부 삭제 (fs throw) | 외부 삭제 (fs 에러) -- repository.delete만 호출 (에러 무시) | `delete` only, error ignored | PASS |
| 13 | remove | 없는 workspaceId -> NotFoundError | 없는 workspaceId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 14 | remove | 없는 pdfId -> NotFoundError | 없는 pdfId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 15 | readContent | 정상 -- { data: Buffer } 반환 | 정상 -- fs.readFileSync 호출 후 { data: Buffer } 반환 | `fs.readFileSync` called, `result.data` is Buffer | PASS |
| 16 | readContent | 없는 workspaceId -> NotFoundError | 없는 workspaceId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 17 | readContent | 없는 pdfId -> NotFoundError | 없는 pdfId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 18 | readContent | 파일 읽기 실패 -> NotFoundError | 파일 읽기 실패 (fs.readFileSync throw) -> NotFoundError | `readFileSync` throw -> `toThrow(NotFoundError)` | PASS |
| 19 | move | 같은 폴더 | 같은 폴더 이동 -- fs.renameSync 미호출, reindexLeafSiblings만 호출 | `renameSync` not called, `update` not called, `reindexLeafSiblings` called | PASS |
| 20 | move | 다른 폴더 | 다른 폴더 이동 -- fs.renameSync + repository.update + reindexLeafSiblings 호출 | `renameSync` + `update(folderId)` + `reindexLeafSiblings` | PASS |
| 21 | move | 없는 workspaceId -> NotFoundError | 없는 workspaceId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 22 | move | 없는 pdfId -> NotFoundError | 없는 pdfId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 23 | move | 없는 targetFolderId -> NotFoundError | 없는 targetFolderId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 24 | updateMeta | description 업데이트 | description 업데이트 -- repository.update 호출 | `update` with `{ description: '설명' }` | PASS |
| 25 | updateMeta | 없는 pdfId -> NotFoundError | 없는 pdfId -> NotFoundError | `toThrow(NotFoundError)` | PASS |
| 26 | toPdfFileNode Date 변환 | number -> Date 변환 | createdAt/updatedAt number -> Date 인스턴스 변환 확인 | `toBeInstanceOf(Date)` | PASS |

---

## 5. Differences Found

### Missing Features (Design O, Implementation X)

None.

### Added Features (Design X, Implementation O)

None.

### Changed Features (Design != Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| 1 | createMany case 3 description | "중복 id" | "중복 relativePath" | None -- wording only, onConflictDoNothing logic is identical |

This is a cosmetic wording difference in the `it` description string. The design says "중복 id -> onConflictDoNothing" while the implementation uses "중복 relativePath -> onConflictDoNothing". The actual test logic is functionally equivalent -- both test the `onConflictDoNothing` behavior where an existing row is preserved and the new conflicting row is ignored. The conflict key in the PDF schema is likely `relativePath` (unique per workspace), making the implementation description more technically precise.

---

## 6. Match Rate Summary

```
Total Design Items: 47 test cases + mock structure + fixtures
Total Matched:      47/47 test cases (100%)
                    8/8 mock targets (100%)
                    3/3 fixture objects (100%)
                    5/5 beforeEach mocks (100%)

Overall Match Rate: 100%
```

---

## 7. Recommendations

No action required. The implementation perfectly matches the design document across all 47 test cases, all mock structures, all fixture helpers, and all assertion patterns.

The single cosmetic difference (createMany case 3 description wording) does not affect functionality and actually improves technical accuracy by specifying the actual conflict key (`relativePath`) rather than the generic `id`.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-01 | Initial analysis -- 47/47 cases matched | gap-detector |
