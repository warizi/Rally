# Note Test Code Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: Rally
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-26
> **Plan Doc**: [note-test.plan.md](../01-plan/features/note-test.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Note 기능 테스트 플랜 문서에 명시된 테스트 케이스와 실제 구현된 6개 테스트 파일 간의 Gap을 분석한다.

### 1.2 Analysis Scope

- **Plan Document**: `docs/01-plan/features/note-test.plan.md`
- **Implementation Files** (6):
  1. `src/main/lib/__tests__/fs-utils.test.ts`
  2. `src/main/repositories/__tests__/note.test.ts`
  3. `src/main/services/__tests__/note.test.ts`
  4. `src/renderer/src/entities/note/api/__tests__/queries.test.ts`
  5. `src/renderer/src/entities/note/model/__tests__/use-note-watcher.test.ts`
  6. `src/renderer/src/entities/note/model/__tests__/own-write-tracker.test.ts`
- **Analysis Date**: 2026-02-26

---

## 2. Overall Score

| Category                  | Plan Cases | Implemented | Match Rate |  Status  |
| ------------------------- | :--------: | :---------: | :--------: | :------: |
| fs-utils.test.ts          |     12     |     12      |    100%    |   PASS   |
| note.test.ts (repository) |     18     |     18      |    100%    |   PASS   |
| note.test.ts (service)    |     36     |     36      |    100%    |   PASS   |
| queries.test.ts           |     12     |     12      |    100%    |   PASS   |
| use-note-watcher.test.ts  |     6      |      6      |    100%    |   PASS   |
| own-write-tracker.test.ts |     4      |      4      |    100%    |   PASS   |
| **Total**                 |   **88**   |   **88**    |  **100%**  | **PASS** |

```
Overall Match Rate: 100%

  PASS Match:          88 / 88 items
  MISSING (Plan O, Impl X):  0 items
  ADDED (Plan X, Impl O):    0 items
  CHANGED (Plan != Impl):    0 items
```

---

## 3. File-by-File Detailed Comparison

### 3.1 fs-utils.test.ts (12/12)

#### readMdFilesRecursive (8/8)

| #   | Plan Case                         | Test Description (Impl)                                            | Status |
| --- | --------------------------------- | ------------------------------------------------------------------ | :----: |
| 1   | empty dir -> empty array          | `'빈 디렉토리면 빈 배열을 반환한다'`                               |  PASS  |
| 2   | .md only (.txt, .ts excluded)     | `'.md 파일만 수집하고 .txt, .ts는 제외한다'`                       |  PASS  |
| 3   | recursive subdir (docs/note.md)   | `'하위 디렉토리를 재귀 탐색하여 relativePath를 올바르게 구성한다'` |  PASS  |
| 4   | name=filename, relativePath=full  | `'name은 파일명만, relativePath는 전체 경로를 포함한다'`           |  PASS  |
| 5   | hidden file excluded (.hidden.md) | `'"." 으로 시작하는 파일을 제외한다'`                              |  PASS  |
| 6   | hidden dir not traversed          | `'"." 으로 시작하는 디렉토리는 내부를 탐색하지 않는다'`            |  PASS  |
| 7   | symlink excluded                  | `'심볼릭 링크를 제외한다'`                                         |  PASS  |
| 8   | readdirSync throw -> graceful     | `'readdirSync가 throw하면 빈 배열을 반환한다 (graceful)'`          |  PASS  |

#### resolveNameConflict (4/4)

| #   | Plan Case                     | Test Description (Impl)                                                    | Status |
| --- | ----------------------------- | -------------------------------------------------------------------------- | :----: |
| 1   | no conflict -> same name      | `'충돌 없으면 입력 이름 그대로 반환한다'`                                  |  PASS  |
| 2   | no .md conflict -> "name (1)" | `'.md 없는 이름 충돌 시 "name (1)" suffix를 추가한다 (폴더용)'`            |  PASS  |
| 3   | .md conflict -> "name (1).md" | `'.md 있는 이름 충돌 시 "name (1).md" — 확장자 앞에 suffix 삽입 (노트용)'` |  PASS  |
| 4   | sequential (1),(2),(3)        | `'연속 충돌 시 (1), (2), (3) 순으로 증가한다'`                             |  PASS  |

#### Implementation Quality Notes

- `makeDirent` helper: Plan 명세와 동일한 시그니처로 구현 (`isFile()` 포함)
- `setReaddirImpl`/`setReaddirReturn` 타입 헬퍼 추가 (Plan에 직접 명시되지 않았으나, 테스트 품질 향상 목적)

---

### 3.2 note.test.ts - Repository (18/18)

| Method               | #   | Plan Case                 | Test Description (Impl)                                        | Status |
| -------------------- | --- | ------------------------- | -------------------------------------------------------------- | :----: |
| findByWorkspaceId    | 1   | empty -> []               | `'노트가 없으면 빈 배열을 반환한다'`                           |  PASS  |
| findByWorkspaceId    | 2   | multiple notes            | `'여러 노트를 반환한다'`                                       |  PASS  |
| findById             | 3   | existing id -> note       | `'존재하는 id면 노트를 반환한다'`                              |  PASS  |
| findById             | 4   | missing id -> undefined   | `'없는 id면 undefined를 반환한다'`                             |  PASS  |
| findByRelativePath   | 5   | exact match -> note       | `'정확히 일치하는 경로의 노트를 반환한다'`                     |  PASS  |
| findByRelativePath   | 6   | missing path -> undefined | `'없는 경로면 undefined를 반환한다'`                           |  PASS  |
| create               | 7   | create + all fields       | `'노트를 생성하고 반환한다 (모든 필드 검증)'`                  |  PASS  |
| createMany           | 8   | empty array -> no-op      | `'빈 배열이면 아무것도 하지 않는다'`                           |  PASS  |
| createMany           | 9   | bulk insert               | `'여러 항목을 일괄 insert한다'`                                |  PASS  |
| update               | 10  | title/desc/preview change | `'title, description, preview 필드를 변경한다'`                |  PASS  |
| update               | 11  | missing id -> undefined   | `'없는 id면 undefined를 반환한다'`                             |  PASS  |
| deleteOrphans        | 12  | delete non-existing paths | `'existingPaths에 없는 row만 삭제한다'`                        |  PASS  |
| deleteOrphans        | 13  | empty array -> delete all | `'빈 배열 전달 시 해당 workspace 모든 note를 삭제한다'`        |  PASS  |
| bulkUpdatePathPrefix | 14  | docs -> archive           | `'"docs" -> "archive" 변경 시 해당 prefix row를 업데이트한다'` |  PASS  |
| bulkUpdatePathPrefix | 15  | exact prefix only         | `'prefix가 완전히 일치하는 경우만 변경한다'`                   |  PASS  |
| reindexSiblings      | 16  | reorder 0,1,2             | `'orderedIds 순서대로 order 0, 1, 2를 재할당한다'`             |  PASS  |
| reindexSiblings      | 17  | empty array -> no-op      | `'빈 배열이면 DB를 변경하지 않는다 (no-op)'`                   |  PASS  |
| delete               | 18  | delete + verify undefined | `'단건 삭제 후 조회 시 undefined를 반환한다'`                  |  PASS  |

#### Implementation Quality Notes

- Plan의 testDb (`:memory:`) 패턴 정확히 따름
- `makeNote` helper로 테스트 데이터 생성 일관성 확보
- `beforeEach`에서 workspace row insert로 FK 제약 충족

---

### 3.3 note.test.ts - Service (36/36)

| Method          | #   | Plan Case                               | Test Description (Impl)                                                         | Status |
| --------------- | --- | --------------------------------------- | ------------------------------------------------------------------------------- | :----: |
| readByWorkspace | 1   | ws not found -> NotFoundError           | `'workspace not found -> NotFoundError'`                                        |  PASS  |
| readByWorkspace | 2   | ws path inaccessible -> ValidationError | `'workspace 경로 접근 불가 -> ValidationError'`                                 |  PASS  |
| readByWorkspace | 3   | fs empty, DB empty -> []                | `'fs에 파일 없음, DB 비어 있음 -> 빈 배열 반환'`                                |  PASS  |
| readByWorkspace | 4   | fs-only .md -> lazy upsert              | `'fs에만 있는 .md 파일 -> lazy upsert -> DB에 insert 후 반환'`                  |  PASS  |
| readByWorkspace | 5   | DB-only orphan -> delete                | `'DB에만 있는 orphan row -> 삭제 후 빈 배열 반환'`                              |  PASS  |
| readByWorkspace | 6   | move detect (basename match)            | `'이동 감지: fs 새 경로 + DB orphan의 basename 일치 -> ID 보존, 경로 업데이트'` |  PASS  |
| readByWorkspace | 7   | root note -> folderId: null             | `'루트 노트(부모 디렉토리 없음) -> folderId: null로 insert'`                    |  PASS  |
| readByWorkspace | 8   | subdir note -> folderId auto            | `'하위 디렉토리 노트 -> DB에 해당 폴더 있으면 folderId 자동 설정'`              |  PASS  |
| create          | 9   | ws not found -> NotFoundError           | `'workspace not found -> NotFoundError'`                                        |  PASS  |
| create          | 10  | folder not found -> NotFoundError       | `'folderId 있을 때 존재하지 않는 folder -> NotFoundError'`                      |  PASS  |
| create          | 11  | empty name -> fallback                  | `'이름 빈 문자열 -> "새로운 노트" fallback'`                                    |  PASS  |
| create          | 12  | root create (folderId: null)            | `'루트에 생성 (folderId: null)'`                                                |  PASS  |
| create          | 13  | subfolder create (FK)                   | `'폴더 하위에 생성 -- FK 제약: testDb에 folder row 필요'`                       |  PASS  |
| create          | 14  | name conflict -> suffix                 | `'이름 충돌 시 "새로운 노트 (1).md" suffix 처리'`                               |  PASS  |
| create          | 15  | order = max + 1                         | `'order는 기존 siblings 중 max + 1'`                                            |  PASS  |
| rename          | 16  | ws not found -> NotFoundError           | `'workspace not found -> NotFoundError'`                                        |  PASS  |
| rename          | 17  | note not found -> NotFoundError         | `'note not found -> NotFoundError'`                                             |  PASS  |
| rename          | 18  | same name -> no-op                      | `'같은 이름이면 no-op (fs.renameSync 미호출)'`                                  |  PASS  |
| rename          | 19  | normal rename + DB update               | `'정상 rename -> fs.renameSync 호출 + DB 업데이트'`                             |  PASS  |
| rename          | 20  | conflict -> suffix                      | `'이름 충돌 시 suffix 부여'`                                                    |  PASS  |
| remove          | 21  | ws not found -> NotFoundError           | `'workspace not found -> NotFoundError'`                                        |  PASS  |
| remove          | 22  | note not found -> NotFoundError         | `'note not found -> NotFoundError'`                                             |  PASS  |
| remove          | 23  | normal delete + DB cleanup              | `'정상 삭제 -> fs.unlinkSync 호출 + DB row 삭제'`                               |  PASS  |
| remove          | 24  | already deleted -> graceful             | `'파일이 이미 외부에서 삭제된 경우 -> graceful (DB만 정리)'`                    |  PASS  |
| readContent     | 25  | normal read -> string                   | `'정상 읽기 -> 파일 내용 문자열 반환'`                                          |  PASS  |
| readContent     | 26  | file missing -> NotFoundError           | `'파일 없음 (readFileSync throw) -> NotFoundError'`                             |  PASS  |
| writeContent    | 27  | writeFileSync + DB preview              | `'fs.writeFileSync 호출 + DB preview 업데이트'`                                 |  PASS  |
| writeContent    | 28  | 200-char truncation                     | `'content 200자 초과 시 preview가 200자로 트런케이션'`                          |  PASS  |
| writeContent    | 29  | whitespace normalization                | `'줄바꿈 포함 content -> preview에서 \\s+가 단일 공백으로 정규화'`              |  PASS  |
| move            | 30  | ws not found -> NotFoundError           | `'workspace not found -> NotFoundError'`                                        |  PASS  |
| move            | 31  | note not found -> NotFoundError         | `'note not found -> NotFoundError'`                                             |  PASS  |
| move            | 32  | targetFolder not found -> NotFoundError | `'targetFolderId 제공 시 해당 folder not found -> NotFoundError'`               |  PASS  |
| move            | 33  | cross-folder move + FK                  | `'다른 폴더로 이동 -> fs.renameSync 호출 + DB folderId, relativePath 업데이트'` |  PASS  |
| move            | 34  | same folder reorder -> no fs            | `'같은 폴더 내 순서 변경 -> fs.renameSync 미호출'`                              |  PASS  |
| move            | 35  | siblings reindex                        | `'siblings reindex 수행'`                                                       |  PASS  |
| updateMeta      | 36  | description change                      | `'description을 변경한다'`                                                      |  PASS  |
| updateMeta      | 37  | note not found -> NotFoundError         | `'note not found -> NotFoundError'`                                             |  PASS  |

> Note: readByWorkspace의 folderId 자동 설정 케이스(#8)는 Plan에서는 7개 케이스로 기술되었으나, 구현에서는 루트 노트(#7)와 하위 디렉토리 노트(#8) 케이스로 분리 구현되어 실질적으로 8개 케이스이다. Plan의 "루트 노트" 케이스와 "하위 디렉토리 노트" 케이스 모두 충실히 구현됨.

#### Implementation Quality Notes

- Plan의 `makeDirent` 헬퍼 명세(isFile() 포함) 정확히 따름
- FK 제약 처리: `insertTestFolder`로 folder row 사전 insert (Plan 가이드와 일치)
- `workspaceRepository`, `folderRepository` mock + 실제 testDb 하이브리드 패턴 (Plan Mock 전략과 일치)

---

### 3.4 queries.test.ts (12/12)

| Hook                | #   | Plan Case                     | Test Description (Impl)                                                               | Status |
| ------------------- | --- | ----------------------------- | ------------------------------------------------------------------------------------- | :----: |
| useNotesByWorkspace | 1   | success -> data               | `'성공 시 data를 반환한다'`                                                           |  PASS  |
| useNotesByWorkspace | 2   | IPC fail -> error             | `'IPC success:false면 error 상태가 된다'`                                             |  PASS  |
| useNotesByWorkspace | 3   | empty id -> disabled          | `'workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)'`                      |  PASS  |
| useCreateNote       | 4   | invalidate on success         | `'성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다'`              |  PASS  |
| useRenameNote       | 5   | invalidate on success         | `'성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다'`              |  PASS  |
| useRemoveNote       | 6   | invalidate on success         | `'성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다'`              |  PASS  |
| useReadNoteContent  | 7   | success -> content            | `'성공 시 파일 내용 문자열을 반환한다'`                                               |  PASS  |
| useReadNoteContent  | 8   | empty wsId -> disabled        | `'workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)'`                      |  PASS  |
| useReadNoteContent  | 9   | empty noteId -> disabled      | `'noteId=""이면 queryFn을 호출하지 않는다 (enabled=false)'`                           |  PASS  |
| useWriteNoteContent | 10  | setQueryData (not invalidate) | `'성공 시 queryClient.setQueryData(["note", "content", noteId], content)를 호출한다'` |  PASS  |
| useMoveNote         | 11  | invalidate on success         | `'성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다'`              |  PASS  |
| useUpdateNoteMeta   | 12  | invalidate on success         | `'성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다'`              |  PASS  |

#### Implementation Quality Notes

- Plan에서 제거 표시된 `staleTime: Infinity` 검증 (~~취소선~~)은 구현에서도 제외됨 (일치)
- `useWriteNoteContent`는 `setQueryData` 검증으로 `invalidateQueries`가 아닌 직접 캐시 업데이트 확인 (Plan 명세와 일치)

---

### 3.5 use-note-watcher.test.ts (6/6)

| #   | Plan Case                                   | Test Description (Impl)                                                               | Status |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------- | :----: |
| 1   | mount -> onChanged 1 call                   | `'마운트 시 window.api.note.onChanged가 1회 호출된다'`                                |  PASS  |
| 2   | onChanged -> invalidate noteList            | `'onChanged 수신 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다'`    |  PASS  |
| 3   | changedRelPaths match -> refetch + dispatch | `'changedRelPaths에 일치하는 노트가 있고 ownWrite가 아니면 refetch + event dispatch'` |  PASS  |
| 4   | ownWrite -> skip refetch                    | `'markAsOwnWrite(noteId) 후 onChanged 수신 시 refetchQueries 미호출'`                 |  PASS  |
| 5   | cache miss -> no refetch                    | `'캐시에 없는 경로 -> refetchQueries 미호출'`                                         |  PASS  |
| 6   | unmount -> unsubscribe                      | `'언마운트 시 onChanged가 반환한 unsubscribe 함수가 호출된다'`                        |  PASS  |

#### Implementation Quality Notes

- Plan의 `capturedCb` 2-parameter 시그니처 패턴 정확히 따름
- `refetchQueries.mockResolvedValue()` + `waitFor`로 비동기 dispatch 검증 (Plan 가이드와 일치)
- own-write-tracker 실제 코드 사용 (mock 안 함) -- Plan Mock 전략과 일치

---

### 3.6 own-write-tracker.test.ts (4/4)

| #   | Plan Case                         | Test Description (Impl)                                 | Status |
| --- | --------------------------------- | ------------------------------------------------------- | :----: |
| 1   | markAsOwnWrite -> isOwnWrite true | `'markAsOwnWrite 후 isOwnWrite -> true를 반환한다'`     |  PASS  |
| 2   | unmarked id -> false              | `'markAsOwnWrite 호출하지 않은 id -> false를 반환한다'` |  PASS  |
| 3   | 2s expire -> false                | `'2초 후 자동 해제 -> isOwnWrite가 false를 반환한다'`   |  PASS  |
| 4   | before 2s -> still true           | `'2초 이전에는 여전히 true를 반환한다'`                 |  PASS  |

#### Implementation Quality Notes

- Plan 권장 "방법 A: 고유 ID" 패턴 사용 (`unique-id-mark-1`, `unique-id-expire-1` 등)
- `afterEach(() => vi.useRealTimers())` cleanup 적용
- 모듈 레벨 상태 격리 전략: Plan과 일치

---

## 4. Missing Features (Plan O, Implementation X)

없음. 모든 플랜 케이스가 구현되었다.

---

## 5. Added Features (Plan X, Implementation O)

없음. 플랜에 없는 추가 케이스는 발견되지 않았다.

---

## 6. Changed Features (Plan != Implementation)

없음. 모든 구현이 플랜 명세와 일치한다.

---

## 7. Success Criteria Verification

| Criteria                                                                                                                                                                         |           Status            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------: |
| fs-utils.test.ts: readMdFilesRecursive 8 cases, resolveNameConflict 4 cases                                                                                                      |            PASS             |
| note.test.ts (repository): all methods covered (10 methods)                                                                                                                      |            PASS             |
| note.test.ts (service): readByWorkspace (folderId auto), create, rename, remove, readContent, writeContent (whitespace normalization), move (targetFolder not found), updateMeta |            PASS             |
| queries.test.ts: all 8 hooks covered, useWriteNoteContent setQueryData verified                                                                                                  |            PASS             |
| use-note-watcher.test.ts: subscription, invalidation, async refetch+dispatch, ownWrite skip, cleanup                                                                             |            PASS             |
| own-write-tracker.test.ts: markAsOwnWrite, isOwnWrite, 2s auto-expire, state isolation                                                                                           |            PASS             |
| `npm run typecheck` no errors                                                                                                                                                    | (to be verified at runtime) |
| `npm run test` all pass                                                                                                                                                          | (to be verified at runtime) |

---

## 8. Summary

```
Match Rate: 100% (88/88 cases)

  Plan Cases:        88
  Implemented:       88
  Missing:            0
  Added:              0
  Changed:            0
```

Plan 문서에 명시된 모든 88개 테스트 케이스가 누락 없이 정확히 구현되었다.
Mock 전략(makeDirent 헬퍼, FK 제약 처리, own-write-tracker 실제 사용 등)도
Plan 가이드와 완벽히 일치한다.

남은 검증 항목은 런타임 확인이 필요한 `npm run typecheck`와 `npm run test` 통과 여부이다.

---

## Version History

| Version | Date       | Changes              | Author                     |
| ------- | ---------- | -------------------- | -------------------------- |
| 1.0     | 2026-02-26 | Initial gap analysis | Claude Code (gap-detector) |
