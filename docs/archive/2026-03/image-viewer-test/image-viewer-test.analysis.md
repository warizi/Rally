# image-viewer-test Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-03-02
> **Design Doc**: [image-viewer-test.design.md](../02-design/features/image-viewer-test.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Design document (`image-viewer-test.design.md`)에 명시된 67건의 테스트 케이스가 실제 구현 코드에 정확하게 반영되었는지 검증한다. 테스트 케이스 수, 설명, mock 설정, assertion, import 경로를 항목별로 비교한다.

### 1.2 Analysis Scope

| 순서 | 파일                                                                                     | 환경 | Design 건수 |
| ---- | ---------------------------------------------------------------------------------------- | ---- | :---------: |
| 1    | `src/main/repositories/__tests__/image-file.test.ts`                                     | Node |     21      |
| 2    | `src/main/services/__tests__/image-file.test.ts`                                         | Node |     29      |
| 3    | `src/renderer/src/entities/image-file/model/__tests__/own-write-tracker.test.ts`         | Web  |      5      |
| 4    | `src/renderer/src/entities/image-file/api/__tests__/queries.test.ts`                     | Web  |     11      |
| 5    | `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts` | Web  |      1      |
|      | **Total**                                                                                |      |   **67**    |

---

## 2. Per-File Gap Analysis

---

### File 1: Repository (`src/main/repositories/__tests__/image-file.test.ts`)

**Design: 21 cases / Implementation: 21 cases**

#### Import & Fixtures

| Item               | Design                                                | Implementation                                        | Status |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------- | :----: |
| vitest imports     | `describe, expect, it, beforeEach`                    | `describe, expect, it, beforeEach`                    | Match  |
| testDb import      | `../../__tests__/setup`                               | `../../__tests__/setup`                               | Match  |
| schema import      | `../../db/schema`                                     | `../../db/schema`                                     | Match  |
| repository import  | `../image-file`                                       | `../image-file`                                       | Match  |
| WS_ID              | `'ws-1'`                                              | `'ws-1'`                                              | Match  |
| makeImage defaults | `id:'img-1', relativePath:'photo.png', title:'photo'` | `id:'img-1', relativePath:'photo.png', title:'photo'` | Match  |

#### Test Cases

| #   | describe             | Design Description                                      | Implementation Description                           |                       Assertion Match                        | Status |
| --- | -------------------- | ------------------------------------------------------- | ---------------------------------------------------- | :----------------------------------------------------------: | :----: |
| 1   | findByWorkspaceId    | image 없을 때 빈 배열 반환                              | image 없을 때 빈 배열 반환                           |                        `toEqual([])`                         | Match  |
| 2   | findByWorkspaceId    | 해당 workspace의 image만 반환                           | 해당 workspace의 image만 반환 (다른 ws 제외)         |                      `toHaveLength(1)`                       | Match  |
| 3   | findById             | 존재하는 id -> ImageFile 반환                           | 존재하는 id -> ImageFile 반환                        |                       `toBeDefined()`                        | Match  |
| 4   | findById             | 없는 id -> undefined                                    | 없는 id -> undefined                                 |                      `toBeUndefined()`                       | Match  |
| 5   | findByRelativePath   | workspaceId + relativePath 일치 -> ImageFile 반환       | workspaceId + relativePath 일치 -> ImageFile 반환    |                    `result!.id === 'rp1'`                    | Match  |
| 6   | findByRelativePath   | 일치 없음 -> undefined                                  | 일치 없음 -> undefined                               |                      `toBeUndefined()`                       | Match  |
| 7   | create               | 모든 필드 포함하여 생성 후 반환                         | 모든 필드 포함하여 생성 후 반환                      |       `row.id, row.title, row.description, row.order`        | Match  |
| 8   | createMany           | 빈 배열 -> no-op                                        | 빈 배열 -> no-op                                     |                  `findByWorkspaceId -> []`                   | Match  |
| 9   | createMany           | 여러 건 삽입                                            | 여러 건 삽입 후 findByWorkspaceId로 확인             |                      `toHaveLength(2)`                       | Match  |
| 10  | createMany           | 중복 (workspaceId, relativePath) -> onConflictDoNothing | 중복 relativePath -> onConflictDoNothing (에러 없음) |                    기존 유지, 새 행 무시                     | Match  |
| 11  | update               | 지정 필드만 변경, 나머지 보존                           | 지정 필드만 변경, 나머지 보존                        |               `title` 변경, `description` 보존               | Match  |
| 12  | update               | 없는 id -> undefined                                    | 없는 id -> undefined                                 |                      `toBeUndefined()`                       | Match  |
| 13  | deleteOrphans        | existingPaths에 없는 image 삭제                         | existingPaths에 없는 image 삭제                      |        keep `toBeDefined()`, orphan `toBeUndefined()`        | Match  |
| 14  | deleteOrphans        | 빈 배열 -> 전체 삭제                                    | existingPaths 빈 배열 -> 전체 삭제                   |                      `toHaveLength(0)`                       | Match  |
| 15  | deleteOrphans        | 모두 있으면 삭제 없음                                   | 모두 existingPaths에 있으면 삭제 없음                |                      `toHaveLength(2)`                       | Match  |
| 16  | bulkDeleteByPrefix   | prefix/ 하위 image만 삭제                               | prefix 하위 image만 삭제, 나머지 보존                |             `docs/` 하위 삭제, `other.png` 보존              | Match  |
| 17  | bulkUpdatePathPrefix | 정확히 oldPrefix 일치 -> newPrefix                      | 정확히 oldPrefix와 일치하는 경로 -> newPrefix로 변경 |               `relativePath === 'new-folder'`                | Match  |
| 18  | bulkUpdatePathPrefix | 하위 경로 변경                                          | oldPrefix/ 하위 경로 -> newPrefix/ 하위로 변경       | `old-folder/a.png` -> `new-folder/a.png`, `other/b.png` 보존 | Match  |
| 19  | bulkUpdatePathPrefix | updatedAt 갱신                                          | updatedAt 갱신 확인                                  |                       `getTime()` 비교                       | Match  |
| 20  | reindexSiblings      | orderedIds 순서대로 order 재설정                        | orderedIds 순서대로 order 재설정                     |                  `ri2.order=0, ri1.order=1`                  | Match  |
| 21  | delete               | 삭제 후 findById -> undefined                           | 삭제 후 findById -> undefined                        |                      `toBeUndefined()`                       | Match  |

**File 1 Match Rate: 21/21 (100%)**

---

### File 2: Service (`src/main/services/__tests__/image-file.test.ts`)

**Design: 29 cases / Implementation: 29 cases**

#### Mock & Fixtures

| Item                     | Design                                                | Implementation                                        | Status |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | :----: |
| vitest imports           | `describe, expect, it, vi, beforeEach`                | `describe, expect, it, vi, beforeEach`                | Match  |
| fs import                | `import fs from 'fs'`                                 | `import fs from 'fs'`                                 | Match  |
| imageFileService import  | `'../image-file'`                                     | `'../image-file'`                                     | Match  |
| imageFileRepository mock | 8 methods mocked                                      | 8 methods mocked                                      | Match  |
| workspaceRepository mock | `findById: vi.fn()`                                   | `findById: vi.fn()`                                   | Match  |
| folderRepository mock    | `findById, findByRelativePath`                        | `findById, findByRelativePath`                        | Match  |
| entityLinkService mock   | `removeAllLinks: vi.fn()`                             | `removeAllLinks: vi.fn()`                             | Match  |
| nanoid mock              | `() => 'mock-id'`                                     | `() => 'mock-id'`                                     | Match  |
| fs-utils mock            | `resolveNameConflict, readImageFilesRecursive`        | `resolveNameConflict, readImageFilesRecursive`        | Match  |
| leaf-reindex mock        | `getLeafSiblings, reindexLeafSiblings`                | `getLeafSiblings, reindexLeafSiblings`                | Match  |
| MOCK_WS                  | `id:'ws-1', name:'T', path:'/t'`                      | `id:'ws-1', name:'T', path:'/t'`                      | Match  |
| MOCK_IMAGE_ROW           | `id:'img-1', title:'photo', relativePath:'photo.png'` | `id:'img-1', title:'photo', relativePath:'photo.png'` | Match  |
| MOCK_FOLDER              | `id:'folder-1', relativePath:'docs'`                  | `id:'folder-1', relativePath:'docs'`                  | Match  |
| beforeEach               | `vi.clearAllMocks()` + 5 default mocks                | `vi.clearAllMocks()` + 5 default mocks                | Match  |

#### Test Cases

| #   | describe                  | Design Description                         | Implementation Description                                       |                                                 Assertion Match                                                 | Status |
| --- | ------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------: | :----: |
| 1   | readByWorkspaceFromDb     | 정상 -- ImageFileNode[] 반환               | 정상 -- repository 호출 후 ImageFileNode[] 반환                  |                              `findByWorkspaceId` 호출, `result[0].id === 'img-1'`                               | Match  |
| 2   | readByWorkspaceFromDb     | 없는 workspaceId -> NotFoundError          | 없는 workspaceId -> NotFoundError                                |                                            `toThrow(NotFoundError)`                                             | Match  |
| 3   | import                    | 정상 가져오기, title 확장자 제거           | 정상 가져오기 -- fs.copyFileSync + repository.create 호출        |                    `fs.copyFileSync`, `create({ title:'photo', relativePath:'photo.png' })`                     | Match  |
| 4   | import                    | folderId 지정                              | folderId 지정 -- folderRepository.findById 호출                  |            `findById('folder-1')`, `create({ folderId:'folder-1', relativePath:'docs/photo.png' })`             | Match  |
| 5   | import                    | 기존 siblings 있을 때 order=maxOrder+1     | 기존 siblings 있을 때 order=maxOrder+1                           |                                 `getLeafSiblings` mock, `create({ order: 3 })`                                  | Match  |
| 6   | import                    | 없는 workspaceId -> NotFoundError          | 없는 workspaceId -> NotFoundError                                |                                            `toThrow(NotFoundError)`                                             | Match  |
| 7   | import                    | 없는 folderId -> NotFoundError             | 없는 folderId -> NotFoundError                                   |                                            `toThrow(NotFoundError)`                                             | Match  |
| 8   | rename                    | 정상 이름 변경                             | 정상 이름 변경 -- fs.renameSync + repository.update 호출         |               `fs.renameSync`, `update('img-1', { title:'newname', relativePath:'newname.png' })`               | Match  |
| 9   | rename                    | 동일 이름 (trim 후 비교) -> 변경 없이 반환 | 동일 이름 (trim 후 비교) -> 변경 없이 기존 객체 반환             |                          `renameSync` 미호출, `update` 미호출, `result.id === 'img-1'`                          | Match  |
| 10  | rename                    | 하위 폴더 내 이미지 rename                 | 하위 폴더 내 이미지 rename -- 폴더 경로 유지                     |        `findById` -> `{ relativePath:'docs/photo.png' }`, `update({ relativePath:'docs/newname.png' })`         | Match  |
| 11  | rename                    | 없는 workspaceId -> NotFoundError          | 없는 workspaceId -> NotFoundError                                |                                            `toThrow(NotFoundError)`                                             | Match  |
| 12  | rename                    | 없는 imageId -> NotFoundError              | 없는 imageId -> NotFoundError                                    |                                            `toThrow(NotFoundError)`                                             | Match  |
| 13  | remove                    | 정상 삭제, 호출 순서 검증                  | 정상 삭제, 호출 순서 검증                                        |              `callOrder === ['unlink','removeLinks','delete']`, `removeAllLinks('image','img-1')`               | Match  |
| 14  | remove                    | 외부 삭제 (fs throw)                       | 외부 삭제 (fs throw) -- removeAllLinks + delete 모두 호출        |                             `unlinkSync` throw -> `removeAllLinks` + `delete` 호출                              | Match  |
| 15  | remove                    | 없는 workspaceId -> NotFoundError          | 없는 workspaceId -> NotFoundError                                |                                            `toThrow(NotFoundError)`                                             | Match  |
| 16  | remove                    | 없는 imageId -> NotFoundError              | 없는 imageId -> NotFoundError                                    |                                            `toThrow(NotFoundError)`                                             | Match  |
| 17  | readContent               | 정상 -- { data: Buffer } 반환              | 정상 -- fs.readFileSync 호출 후 { data: Buffer } 반환            |                                `fs.readFileSync` 호출, `result.data`가 `Buffer`                                 | Match  |
| 18  | readContent               | 없는 workspaceId -> NotFoundError          | 없는 workspaceId -> NotFoundError                                |                                            `toThrow(NotFoundError)`                                             | Match  |
| 19  | readContent               | 없는 imageId -> NotFoundError              | 없는 imageId -> NotFoundError                                    |                                            `toThrow(NotFoundError)`                                             | Match  |
| 20  | readContent               | 파일 읽기 실패 -> NotFoundError            | 파일 읽기 실패 (fs.readFileSync throw) -> NotFoundError          |                                `readFileSync` throw -> `toThrow(NotFoundError)`                                 | Match  |
| 21  | move                      | 같은 폴더 (null->null)                     | 같은 폴더 (null->null) -- fs.renameSync 미호출                   |                        `renameSync` 미호출, `update` 미호출, `reindexLeafSiblings` 호출                         | Match  |
| 22  | move                      | 루트->폴더 (null->folder-1)                | 루트->폴더 (null->folder-1)                                      | `renameSync` 호출, `update({ folderId:'folder-1', relativePath:'docs/photo.png' })`, `reindexLeafSiblings` 호출 | Match  |
| 23  | move                      | 폴더->루트 (folder-1->null)                | 폴더->루트 (folder-1->null) -- relativePath에서 폴더 prefix 제거 |               `update({ folderId: null, relativePath:'photo.png' })`, `reindexLeafSiblings` 호출                | Match  |
| 24  | move                      | 없는 workspaceId -> NotFoundError          | 없는 workspaceId -> NotFoundError                                |                                            `toThrow(NotFoundError)`                                             | Match  |
| 25  | move                      | 없는 imageId -> NotFoundError              | 없는 imageId -> NotFoundError                                    |                                            `toThrow(NotFoundError)`                                             | Match  |
| 26  | move                      | 없는 targetFolderId -> NotFoundError       | 없는 targetFolderId -> NotFoundError                             |                                            `toThrow(NotFoundError)`                                             | Match  |
| 27  | updateMeta                | description 업데이트                       | description 업데이트 -- repository.update 호출                   |                                    `update('img-1', { description:'설명' })`                                    | Match  |
| 28  | updateMeta                | 없는 imageId -> NotFoundError              | 없는 imageId -> NotFoundError                                    |                                            `toThrow(NotFoundError)`                                             | Match  |
| 29  | toImageFileNode Date 변환 | createdAt/updatedAt number -> Date 변환    | createdAt/updatedAt number -> Date 인스턴스 변환 확인            |                                             `toBeInstanceOf(Date)`                                              | Match  |

**File 2 Match Rate: 29/29 (100%)**

---

### File 3: own-write-tracker (`src/renderer/src/entities/image-file/model/__tests__/own-write-tracker.test.ts`)

**Design: 5 cases / Implementation: 5 cases**

#### Import & Setup

| Item           | Design                                | Implementation                        | Status |
| -------------- | ------------------------------------- | ------------------------------------- | :----: |
| vitest imports | `describe, it, expect, vi, afterEach` | `describe, it, expect, vi, afterEach` | Match  |
| module import  | `'../own-write-tracker'`              | `'../own-write-tracker'`              | Match  |
| afterEach      | `vi.useRealTimers()`                  | `vi.useRealTimers()`                  | Match  |

#### Test Cases

| #   | describe                    | Design Description                   | Implementation Description                          |                  Assertion Match                   | Status |
| --- | --------------------------- | ------------------------------------ | --------------------------------------------------- | :------------------------------------------------: | :----: |
| 1   | markAsOwnWrite + isOwnWrite | markAsOwnWrite 후 isOwnWrite -> true | markAsOwnWrite 후 isOwnWrite -> true를 반환한다     |     `isOwnWrite('unique-id-1') -> toBe(true)`      | Match  |
| 2   | markAsOwnWrite + isOwnWrite | 미호출 id -> false                   | markAsOwnWrite 호출하지 않은 id -> false를 반환한다 |    `isOwnWrite('never-marked') -> toBe(false)`     | Match  |
| 3   | 2초 자동 해제               | 2초 후 자동 해제 -> false            | 2초 후 자동 해제 -> isOwnWrite가 false를 반환한다   |     `advanceTimersByTime(2001) -> toBe(false)`     | Match  |
| 4   | 2초 자동 해제               | 2초 이전 -> true                     | 2초 이전에는 여전히 true를 반환한다                 |     `advanceTimersByTime(1999) -> toBe(true)`      | Match  |
| 5   | 타이머 리셋                 | 같은 id 재호출 시 타이머 리셋        | 같은 id 재호출 시 타이머가 리셋된다                 | mark -> 1초 -> re-mark -> +1999ms true, +2ms false | Match  |

**Cosmetic Diff**: Test IDs use `'unique-id-mark-1'` / `'unique-id-expire-1'` / `'unique-id-expire-2'` instead of design's `'unique-id-1'` / same pattern for expiry tests. This is functionally equivalent since each test uses a unique ID for module-level Map isolation. Not a gap.

**File 3 Match Rate: 5/5 (100%)**

---

### File 4: queries (`src/renderer/src/entities/image-file/api/__tests__/queries.test.ts`)

**Design: 11 cases / Implementation: 11 cases**

#### Import & Mock

| Item                    | Design                                                                              | Implementation                                    | Status |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- | :----: |
| vitest imports          | `describe, it, expect, vi, beforeEach, afterEach`                                   | `describe, it, expect, vi, beforeEach, afterEach` | Match  |
| react imports           | `createElement, ReactNode`                                                          | `createElement, ReactNode`                        | Match  |
| testing-library imports | `renderHook, act, waitFor`                                                          | `renderHook, act, waitFor`                        | Match  |
| react-query imports     | `QueryClient, QueryClientProvider`                                                  | `QueryClient, QueryClientProvider`                | Match  |
| hook imports (7 hooks)  | `useImageFilesByWorkspace` + 6 mutations                                            | All 7 hooks imported                              | Match  |
| type imports            | `ImageFileNode` from `../../model/types`                                            | `ImageFileNode` from `../../model/types`          | Match  |
| window.api mock         | `image: { readByWorkspace, import, rename, remove, readContent, move, updateMeta }` | Identical structure                               | Match  |
| SAMPLE_IMAGE            | `id:'img-1', title:'photo', relativePath:'photo.png'`                               | Identical                                         | Match  |
| createWrapper           | `QueryClient({ retry: false })`                                                     | Identical pattern                                 | Match  |

#### Test Cases

| #   | describe                 | Design Description                 | Implementation Description                                          |                         Assertion Match                         | Status |
| --- | ------------------------ | ---------------------------------- | ------------------------------------------------------------------- | :-------------------------------------------------------------: | :----: |
| 1   | useImageFilesByWorkspace | 성공 시 data 반환                  | 성공 시 data를 반환한다                                             |          `isSuccess === true, data[0].id === 'img-1'`           | Match  |
| 2   | useImageFilesByWorkspace | IPC success:false -> error 상태    | IPC success:false면 error 상태가 된다                               |                       `isError === true`                        | Match  |
| 3   | useImageFilesByWorkspace | workspaceId="" -> queryFn 미호출   | workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)        |             `mockReadByWorkspace` not called (50ms)             | Match  |
| 4   | useImportImageFile       | 성공 시 invalidate                 | 성공 시 ["image","workspace",workspaceId] queryKey를 invalidate한다 | `invalidateQueries({ queryKey: ['image','workspace','ws-1'] })` | Match  |
| 5   | useRenameImageFile       | 성공 시 invalidate                 | 성공 시 ["image","workspace",workspaceId] queryKey를 invalidate한다 | `invalidateQueries({ queryKey: ['image','workspace','ws-1'] })` | Match  |
| 6   | useRemoveImageFile       | 성공 시 invalidate                 | 성공 시 ["image","workspace",workspaceId] queryKey를 invalidate한다 | `invalidateQueries({ queryKey: ['image','workspace','ws-1'] })` | Match  |
| 7   | useReadImageContent      | 성공 시 { data: ArrayBuffer } 반환 | 성공 시 { data: ArrayBuffer } 반환                                  |              `isSuccess === true, data.data` 존재               | Match  |
| 8   | useReadImageContent      | workspaceId="" -> queryFn 미호출   | workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)        |               `mockReadContent` not called (50ms)               | Match  |
| 9   | useReadImageContent      | imageId="" -> queryFn 미호출       | imageId=""이면 queryFn을 호출하지 않는다 (enabled=false)            |               `mockReadContent` not called (50ms)               | Match  |
| 10  | useMoveImageFile         | 성공 시 invalidate                 | 성공 시 ["image","workspace",workspaceId] queryKey를 invalidate한다 | `invalidateQueries({ queryKey: ['image','workspace','ws-1'] })` | Match  |
| 11  | useUpdateImageMeta       | 성공 시 invalidate                 | 성공 시 ["image","workspace",workspaceId] queryKey를 invalidate한다 | `invalidateQueries({ queryKey: ['image','workspace','ws-1'] })` | Match  |

**Mutation Arguments Match (design vs implementation):**

| Hook               | Design mutate args                                                        | Implementation mutate args                                                | Status |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | :----: |
| useImportImageFile | `{ workspaceId:'ws-1', folderId:null, sourcePath:'/source/photo.png' }`   | `{ workspaceId:'ws-1', folderId:null, sourcePath:'/source/photo.png' }`   | Match  |
| useRenameImageFile | `{ workspaceId:'ws-1', imageId:'img-1', newName:'renamed' }`              | `{ workspaceId:'ws-1', imageId:'img-1', newName:'renamed' }`              | Match  |
| useRemoveImageFile | `{ workspaceId:'ws-1', imageId:'img-1' }`                                 | `{ workspaceId:'ws-1', imageId:'img-1' }`                                 | Match  |
| useMoveImageFile   | `{ workspaceId:'ws-1', imageId:'img-1', folderId:null, index:0 }`         | `{ workspaceId:'ws-1', imageId:'img-1', folderId:null, index:0 }`         | Match  |
| useUpdateImageMeta | `{ workspaceId:'ws-1', imageId:'img-1', data:{ description:'updated' } }` | `{ workspaceId:'ws-1', imageId:'img-1', data:{ description:'updated' } }` | Match  |

**File 4 Match Rate: 11/11 (100%)**

---

### File 5: to-tab-options (`src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts`)

**Design: 1 added case / Implementation: 1 added case (within existing file of 5 other cases)**

#### Test Case

| #   | Design Description                                                   | Implementation Description                                           |                                               Assertion Match                                                | Status |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------: | :----: |
| 1   | `image -> type='image', pathname='/folder/image/{id}', title=전달값` | `image -> type='image', pathname='/folder/image/{id}', title=전달값` | `toTabOptions('image','i-1','사진.png') -> { type:'image', pathname:'/folder/image/i-1', title:'사진.png' }` | Match  |

**File context**: The existing file has 5 tests (todo, note, pdf, csv, schedule). The design specified adding 1 image test case. Implementation has exactly 6 total tests, with the image case present at the expected position.

**File 5 Match Rate: 1/1 (100%)**

---

## 3. Overall Scores

| Category                  |      Score       |  Status   |
| ------------------------- | :--------------: | :-------: |
| File 1: Repository        |   100% (21/21)   |   Match   |
| File 2: Service           |   100% (29/29)   |   Match   |
| File 3: own-write-tracker |    100% (5/5)    |   Match   |
| File 4: queries           |   100% (11/11)   |   Match   |
| File 5: to-tab-options    |    100% (1/1)    |   Match   |
| **Overall**               | **100% (67/67)** | **Match** |

---

## 4. Cosmetic Differences (Non-Functional)

These differences do not affect test behavior or match rate.

| #   | File                  | Design                                         | Implementation                                 | Impact                                                  |
| --- | --------------------- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| 1   | own-write-tracker     | unique ID: `'unique-id-1'`                     | unique ID: `'unique-id-mark-1'`                | None -- more descriptive naming, functionally identical |
| 2   | own-write-tracker     | `'never-marked'`                               | `'never-marked-id'`                            | None -- functionally identical                          |
| 3   | own-write-tracker     | `'unique-id-expire-...'` pattern for cases 3-4 | `'unique-id-expire-1'`, `'unique-id-expire-2'` | None -- unique IDs for isolation, same pattern          |
| 4   | service (readContent) | `result.data` is `Buffer` check                | `result.data` === `buf` (reference equality)   | None -- stronger assertion than design                  |
| 5   | createMany test 3     | Design: "중복 (workspaceId, relativePath)"     | Impl: "중복 relativePath"                      | None -- more concise wording, same test                 |

---

## 5. Missing Features (Design O, Implementation X)

None found. All 67 design test cases are implemented.

---

## 6. Added Features (Design X, Implementation O)

None found. No extra test cases beyond the 67 specified in design.

---

## 7. Changed Features (Design != Implementation)

None found. All test descriptions, mock setups, and assertions match the design specification.

---

## 8. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100% (67/67)            |
+---------------------------------------------+
|  Match:              67 items (100%)         |
|  Missing (D>I):       0 items (0%)          |
|  Added (I>D):         0 items (0%)          |
|  Changed:             0 items (0%)          |
|  Cosmetic Only:       5 items (non-scored)  |
+---------------------------------------------+
```

---

## 9. Design-Implementation Alignment Details

### Test Strategy Compliance

| Strategy                                       | Design    | Implementation | Status |
| ---------------------------------------------- | --------- | -------------- | :----: |
| Repository: real testDb (SQLite)               | Specified | Applied        | Match  |
| Service: vi.mock all dependencies              | Specified | Applied        | Match  |
| own-write-tracker: vi.useFakeTimers            | Specified | Applied        | Match  |
| queries: window.api mock + QueryClient wrapper | Specified | Applied        | Match  |
| to-tab-options: pure function assertion        | Specified | Applied        | Match  |
| beforeEach: vi.clearAllMocks (service)         | Specified | Applied        | Match  |
| afterEach: vi.useRealTimers (tracker)          | Specified | Applied        | Match  |
| afterEach: delete window.api (queries)         | Specified | Applied        | Match  |

### Key Design Patterns Verified

| Pattern                                               | Design Spec                            | Implementation          | Status |
| ----------------------------------------------------- | -------------------------------------- | ----------------------- | :----: |
| remove: call order verification via callOrder array   | Exact code snippet provided            | Implemented identically | Match  |
| remove: entityLinkService.removeAllLinks('image', id) | First arg `'image'` string required    | Verified in assertion   | Match  |
| move: folder->root prefix removal                     | Mock setup + assertion provided        | Implemented identically | Match  |
| rename: subfolder path preservation                   | `docs/photo.png` -> `docs/newname.png` | Implemented identically | Match  |
| import: order=maxOrder+1 from siblings                | `getLeafSiblings` mock with order:2    | Implemented identically | Match  |

---

## 10. Recommended Actions

No actions required. Design and implementation are fully aligned at 100% match rate.

---

## 11. Next Steps

- [x] All 67 test cases implemented matching design
- [ ] Run `npm run test` to verify Node tests pass (repository + service)
- [ ] Run `npm run test:web` to verify renderer tests pass (own-write-tracker + queries + to-tab-options)
- [ ] Run `npm run typecheck` for type verification
- [ ] Write completion report (`image-viewer-test.report.md`)

---

## Version History

| Version | Date       | Changes              | Author       |
| ------- | ---------- | -------------------- | ------------ |
| 1.0     | 2026-03-02 | Initial gap analysis | gap-detector |
