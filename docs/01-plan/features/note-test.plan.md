# Note Test Code Plan

## Overview

Note 기능의 테스트 코드를 작성한다.

Note 구현이 완료된 레이어 현황:

- `src/main/lib/fs-utils.ts` ✅ — `readMdFilesRecursive`, `resolveNameConflict` 공유 유틸
- `src/main/repositories/note.ts` ✅ — DB CRUD
- `src/main/services/note.ts` ✅ — fs I/O + 비즈니스 로직
- `src/renderer/src/entities/note/api/queries.ts` ✅ — React Query hooks
- `src/renderer/src/entities/note/model/use-note-watcher.ts` ✅ — push 이벤트 구독 훅
- `src/renderer/src/entities/note/model/own-write-tracker.ts` ✅ — 자체 저장 추적

아직 테스트 코드가 없으므로 모든 레이어에 대해 작성한다.

---

## 테스트 대상 (6개)

### 1. `readMdFilesRecursive` + `resolveNameConflict` 공유 유틸

**파일**: `src/main/lib/fs-utils.ts`
**테스트 파일**: `src/main/lib/__tests__/fs-utils.test.ts`

#### `readMdFilesRecursive` 테스트 케이스

- 빈 디렉토리 → 빈 배열 반환
- `.md` 파일만 수집 (`.txt`, `.ts` 제외)
- 하위 디렉토리 재귀 탐색 (`docs/note.md` → `relativePath: 'docs/note.md'`)
- `name`은 파일명만(`note.md`), `relativePath`는 전체 경로 포함
- 숨김 파일(`.` 시작) 제외 (`name.startsWith('.')`)
- 숨김 디렉토리 내부 탐색 안 함
- 심볼릭 링크 제외
- `readdirSync` throw 시 빈 배열 반환 (graceful)

#### `makeDirent` 헬퍼 — `isFile()` 필수 포함

`readMdFilesRecursive`는 `entry.isFile()`을 호출하므로 (`fs-utils.ts:30`),
기존 `folder.test.ts`의 `makeDirent`를 그대로 쓰면 `TypeError: entry.isFile is not a function` 발생.
`fs-utils.test.ts` 전용 헬퍼를 아래와 같이 정의:

```typescript
function makeDirent(
  name: string,
  opts: { isDir?: boolean; isFile?: boolean; isSymlink?: boolean } = {}
): fs.Dirent {
  const { isDir = false, isFile = !isDir, isSymlink = false } = opts
  return {
    name,
    isSymbolicLink: () => isSymlink,
    isDirectory: () => isDir,
    isFile: () => isFile
  } as unknown as fs.Dirent
}
// 사용 예: 폴더 → makeDirent('docs', { isDir: true })
//         파일 → makeDirent('note.md')  (isFile=true가 기본값)
```

#### `resolveNameConflict` 테스트 케이스

- 충돌 없으면 입력 이름 그대로 반환
- `.md` 없는 이름 충돌 시 `"name (1)"` suffix 추가 (폴더용)
- `.md` 있는 이름 충돌 시 `"name (1).md"` — 확장자 앞에 suffix 삽입 (노트용)
- 연속 충돌 시 `(1)`, `(2)`, `(3)` 순으로 증가

---

### 2. `noteRepository` CRUD

**파일**: `src/main/repositories/note.ts`
**테스트 파일**: `src/main/repositories/__tests__/note.test.ts`

Folder 테스트 패턴과 동일 — 실제 testDb (`:memory:`) 사용.

#### 테스트 케이스

**findByWorkspaceId:**

- 노트 없으면 빈 배열 반환
- 여러 노트 반환

**findById:**

- 존재하는 id → 노트 반환
- 없는 id → `undefined` 반환

**findByRelativePath:**

- 정확히 일치하는 경로 → 노트 반환
- 없는 경로 → `undefined` 반환

**create:**

- 노트를 생성하고 반환 (모든 필드 검증)

**createMany:**

- 빈 배열 → no-op
- 여러 항목 일괄 insert

**update:**

- `title`, `description`, `preview` 등 필드 변경
- 없는 id → `undefined` 반환

**deleteOrphans:**

- `existingPaths`에 없는 row만 삭제
- 빈 배열 전달 시 해당 workspace 모든 note 삭제

**bulkUpdatePathPrefix:**

- `"docs"` → `"archive"` 변경 시 `"docs/note.md"` → `"archive/note.md"` 업데이트
- prefix가 완전히 일치하는 경우만 (`"doc"` prefix로 `"docs/note.md"` 변경 안 됨)

**reindexSiblings:**

- `orderedIds` 순서대로 `order` 0, 1, 2 재할당
- 빈 배열 → no-op

**delete:**

- 단건 삭제 후 조회 시 `undefined` 반환

---

### 3. `noteService` 비즈니스 로직

**파일**: `src/main/services/note.ts`
**테스트 파일**: `src/main/services/__tests__/note.test.ts`

Folder 서비스 테스트 패턴과 동일 — `fs`와 `workspaceRepository`를 `vi.mock`, 실제 testDb 사용.

#### `readByWorkspace` 테스트 케이스

- workspace not found → `NotFoundError`
- workspace 경로 접근 불가 → `ValidationError`
- fs에 파일 없음, DB 비어 있음 → 빈 배열 반환
- fs에만 있는 `.md` 파일 → lazy upsert → DB에 insert 후 반환
- DB에만 있는 orphan row → 삭제 후 반환
- 이동 감지: fs 새 경로 + DB orphan의 basename 일치 → ID 보존, 경로 업데이트
- 루트 노트(부모 디렉토리 없음) → `folderId: null`으로 insert
- 하위 디렉토리 노트(fs: `"docs/note.md"`) + DB에 `"docs"` 폴더 있음 → `folderId`가 해당 폴더 ID로 설정됨
  - `foreign_keys = ON` 상태에서 `noteRepository.createMany`(실제 testDb)가 `folderId`를 insert하므로
    **testDb에 folder row가 실제로 존재해야 FK 제약을 통과함**
  - `folderRepository.findByRelativePath` mock의 반환값 ID가 testDb insert ID와 일치해야 함
  ```typescript
  testDb.insert(schema.folders).values({ id: 'f-docs', workspaceId: 'ws-1', relativePath: 'docs', ... }).run()
  vi.mocked(folderRepository.findByRelativePath).mockReturnValue({ id: 'f-docs', ... })
  ```

#### `readByWorkspace` `readdirSync` mock 패턴 주의

`readMdFilesRecursive`는 내부에서 `entry.isFile()`을 호출함 (`fs-utils.ts:30`).
`noteService.readByWorkspace` 테스트에서 `fs.readdirSync` mock은 **`isFile()`을 포함한 `Dirent`** 를 반환해야 함.
`folder.service.test.ts`의 `makeDirent`는 `isFile()`이 없으므로 그대로 복사하면 안 되고,
아래 헬퍼를 `note.test.ts` (service)에 별도 정의:

```typescript
function makeDirent(
  name: string,
  opts: { isDir?: boolean; isFile?: boolean; isSymlink?: boolean } = {}
): fs.Dirent {
  const { isDir = false, isFile = !isDir, isSymlink = false } = opts
  return {
    name,
    isSymbolicLink: () => isSymlink,
    isDirectory: () => isDir,
    isFile: () => isFile
  } as unknown as fs.Dirent
}
// 사용 예: makeDirent('note.md')              → isFile=true (기본값)
//         makeDirent('docs', { isDir: true }) → isDirectory=true
```

#### `create` 테스트 케이스

- workspace not found → `NotFoundError`
- folderId 있을 때 존재하지 않는 folder → `NotFoundError`
- 이름 빈 문자열 → `'새로운 노트'` fallback
- 루트에 생성 (`folderId: null`)
- 폴더 하위에 생성 (`relativePath: 'folder/새로운 노트.md'`)
  - `noteRepository.create({ folderId, ... })`(실제 testDb)에 FK 제약 적용 →
    **`folderId`에 해당하는 folder row를 testDb에 미리 insert 필요** (`readByWorkspace` folderId 케이스와 동일 패턴)
- 이름 충돌 시 `'새로운 노트 (1).md'` 처리
- `order`는 기존 siblings 중 max + 1

#### `rename` 테스트 케이스

- workspace not found → `NotFoundError`
- note not found → `NotFoundError`
- 같은 이름 → no-op (fs.renameSync 미호출)
- 정상 rename → `fs.renameSync` 호출 + DB 업데이트
- 이름 충돌 시 suffix 부여

#### `remove` 테스트 케이스

- workspace not found → `NotFoundError`
- note not found → `NotFoundError`
- 정상 삭제 → `fs.unlinkSync` 호출 + DB row 삭제
- 파일이 이미 외부에서 삭제된 경우 → graceful (crash 없이 DB만 정리)

#### `readContent` 테스트 케이스

- 정상 읽기 → 파일 내용 문자열 반환
- 파일 없음(`readFileSync` throw) → `NotFoundError`

#### `writeContent` 테스트 케이스

- `fs.writeFileSync` 호출 + DB `preview` 업데이트
- content 200자 초과 시 `preview`가 200자로 트런케이션
- 줄바꿈 포함 content → `preview`에서 `\s+`가 단일 공백으로 정규화
  (예: `"hello\nworld"` → `preview: "hello world"`)

#### `move` 테스트 케이스

- workspace not found → `NotFoundError`
- note not found → `NotFoundError`
- targetFolderId 제공 시 해당 folder not found → `NotFoundError`
- 다른 폴더로 이동 → `fs.renameSync` 호출 + DB `folderId`, `relativePath` 업데이트
  - `noteRepository.update(noteId, { folderId: targetFolderId, ... })`(실제 testDb)에 FK 제약 적용 →
    **`targetFolderId`에 해당하는 folder row를 testDb에 미리 insert 필요**
- 같은 폴더 내 순서 변경 → `fs.renameSync` 미호출
- siblings reindex 수행

#### `updateMeta` 테스트 케이스

- `description` 변경
- note not found → `NotFoundError`

---

### 4. Note React Query hooks

**파일**: `src/renderer/src/entities/note/api/queries.ts`
**테스트 파일**: `src/renderer/src/entities/note/api/__tests__/queries.test.ts`

Folder queries 테스트 패턴과 동일 — `window.api.note` mock 사용.

#### 테스트 케이스

**useNotesByWorkspace:**

- 성공 시 `data` 반환
- IPC `success: false` → error 상태
- `workspaceId=""` → `enabled: false` (queryFn 미호출)

**useCreateNote:**

- 성공 시 `['note', 'workspace', workspaceId]` queryKey invalidate

**useRenameNote:**

- 성공 시 `['note', 'workspace', workspaceId]` queryKey invalidate

**useRemoveNote:**

- 성공 시 `['note', 'workspace', workspaceId]` queryKey invalidate

**useReadNoteContent:**

- 성공 시 파일 내용 반환
- `workspaceId=""` 또는 `noteId=""` → `enabled: false` (queryFn 미호출)
- ~~`staleTime: Infinity` 검증~~ → **제거**: React Query 내부 동작 영역이고 window focus refetch를
  happy-dom에서 정확히 제어하기 어려움. 소스에서 옵션 존재를 직접 확인하는 것으로 대체.

**useWriteNoteContent:**

- 성공 시 `queryClient.setQueryData(['note', 'content', noteId], content)` 호출
  (invalidate가 아닌 setQueryData로 직접 캐시 업데이트)

**useMoveNote:**

- 성공 시 `['note', 'workspace', workspaceId]` queryKey invalidate

**useUpdateNoteMeta:**

- 성공 시 `['note', 'workspace', workspaceId]` queryKey invalidate

---

### 5. `useNoteWatcher` 훅

**파일**: `src/renderer/src/entities/note/model/use-note-watcher.ts`
**테스트 파일**: `src/renderer/src/entities/note/model/__tests__/use-note-watcher.test.ts`

#### 테스트 케이스

**구독 등록:**

- 마운트 시 `window.api.note.onChanged` 1회 호출

**note 목록 invalidate:**

- `onChanged('ws-1', [])` 호출 시 `['note', 'workspace', 'ws-1']` queryKey invalidate

**외부 변경 파일 content refetch:**

- `onChanged('ws-1', ['docs/note.md'])` 호출 시
  - QueryCache에 해당 relativePath 노트가 있고 ownWrite가 아니면
    → `['note', 'content', noteId]` queryKey refetch 호출
    → `NOTE_EXTERNAL_CHANGED_EVENT` CustomEvent dispatch
- **비동기 처리 주의**: refetch는 Promise를 반환하고 `.then()`에서 이벤트를 dispatch함
  → `refetchQueries`를 `mockResolvedValue()`로 mock하고 `waitFor`로 dispatch 검증

- **`capturedCb` 타입 주의**: folder watcher(1개)와 달리 note watcher 콜백은 2개 파라미터

  ```typescript
  // 콜백 캡처 mock (2-param signature 필수)
  let capturedCb: (workspaceId: string, changedRelPaths: string[]) => void
  const mockOnChanged = vi
    .fn()
    .mockImplementation((cb: (workspaceId: string, changedRelPaths: string[]) => void) => {
      capturedCb = cb
      return mockUnsubscribe
    })

  // refetch + dispatch 검증
  vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined as never)
  vi.spyOn(queryClient, 'getQueryData').mockReturnValue([...notes])
  const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

  act(() => {
    capturedCb('ws-1', ['docs/note.md'])
  })

  await waitFor(() =>
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: NOTE_EXTERNAL_CHANGED_EVENT })
    )
  )
  ```

**자체 저장 파일 스킵:**

- `markAsOwnWrite(noteId)` 호출 후 `onChanged` 수신 시 → `refetchQueries` 및 event dispatch 미호출
- own-write-tracker는 실제 코드 사용 (mock 안 함) — `markAsOwnWrite` 직접 호출로 상태 주입

**캐시에 없는 경로 → refetch 미호출:**

- QueryCache가 비어 있거나 `changedRelPaths`에 일치하는 노트가 없으면 `refetchQueries` 미호출
  (`notes.filter(...)` 결과가 빈 배열 → `forEach` 실행 안 됨)

**언마운트 cleanup:**

- 언마운트 시 `onChanged`가 반환한 unsubscribe 함수 호출

---

### 6. `own-write-tracker` 순수 유틸

**파일**: `src/renderer/src/entities/note/model/own-write-tracker.ts`
**테스트 파일**: `src/renderer/src/entities/note/model/__tests__/own-write-tracker.test.ts`

#### 테스트 케이스

- `markAsOwnWrite('n1')` 후 `isOwnWrite('n1')` → `true`
- `markAsOwnWrite` 호출하지 않은 id → `false`
- 2초 후 자동 해제 — `vi.useFakeTimers()` + `vi.advanceTimersByTime(2001)` → `false`
- 2초 이전에는 여전히 `true` → `vi.advanceTimersByTime(1999)` → `true`

#### 모듈 레벨 상태 격리

`pendingWrites`는 모듈 레벨 `Set`이므로 테스트 간 상태가 공유됨.
각 테스트에서 **고유한 noteId**를 사용하거나, `afterEach`에서 `vi.advanceTimersByTime(2001)`로 cleanup:

```typescript
// 방법 A: 각 테스트에 고유 ID 사용 (권장)
it('...', () => {
  markAsOwnWrite('unique-id-for-this-test')
  // ...
})

// 방법 B: afterEach에서 fake timer advance로 강제 해제
afterEach(() => {
  vi.advanceTimersByTime(2001)
})
```

---

## 파일 구조

```
src/main/lib/__tests__/
  fs-utils.test.ts                             (NEW)

src/main/repositories/__tests__/
  note.test.ts                                  (NEW)

src/main/services/__tests__/
  note.test.ts                                  (NEW)

src/renderer/src/entities/note/api/__tests__/
  queries.test.ts                               (NEW)

src/renderer/src/entities/note/model/__tests__/
  use-note-watcher.test.ts                      (NEW)
  own-write-tracker.test.ts                     (NEW)
```

---

## Mock 전략

### Main Process 테스트 (Node 환경)

| 모듈                           | Mock 방식                                                           |
| ------------------------------ | ------------------------------------------------------------------- |
| `fs`                           | `vi.mock('fs')` (자동 호이스팅)                                     |
| `../../repositories/workspace` | `vi.mock(...)` → `findById: vi.fn()`                                |
| `../../repositories/folder`    | `vi.mock(...)` → `findById: vi.fn()`, `findByRelativePath: vi.fn()` |
| `../../repositories/note`      | 실제 testDb 사용 (mock 불필요)                                      |
| `../../db`                     | `src/main/__tests__/setup.ts`에서 testDb로 대체                     |

`fs-utils.test.ts`에서는 `vi.mock('fs')`로 `accessSync`, `readdirSync` mock.
`note.test.ts` (service)에서는 `fs`, `workspaceRepository`, `folderRepository` mock.

### Renderer 테스트 (happy-dom 환경)

| 모듈                                            | Mock 방식                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `window.api.note`                               | `beforeEach`에서 직접 할당                                                                                                      |
| QueryClient                                     | `createWrapper()` 헬퍼로 격리                                                                                                   |
| own-write-tracker (`queries.test.ts`)           | **mock 안 함** — `useWriteNoteContent` 테스트 시 실제 `markAsOwnWrite` 호출되지만 테스트 결과에 영향 없음 (setQueryData만 검증) |
| own-write-tracker (`use-note-watcher.test.ts`)  | **실제 코드 사용** — `markAsOwnWrite` 직접 호출로 상태 주입                                                                     |
| own-write-tracker (`own-write-tracker.test.ts`) | **실제 코드 사용** + `vi.useFakeTimers()`로 시간 제어                                                                           |

---

## Vitest 환경

| 테스트 파일       | 환경      | vitest config            |
| ----------------- | --------- | ------------------------ |
| `src/main/**`     | Node      | `vitest.config.node.mts` |
| `src/renderer/**` | happy-dom | `vitest.config.web.mts`  |

---

## 구현 우선순위

| 우선순위 | 테스트 파일                 | 이유                               |
| -------- | --------------------------- | ---------------------------------- |
| 1        | `fs-utils.test.ts`          | 공유 유틸 — note, folder 양쪽 영향 |
| 2        | `note.test.ts` (repository) | DB CRUD 기반 검증                  |
| 3        | `note.test.ts` (service)    | 핵심 비즈니스 로직                 |
| 4        | `queries.test.ts`           | React Query hooks                  |
| 5        | `use-note-watcher.test.ts`  | push 이벤트 처리                   |
| 6        | `own-write-tracker.test.ts` | 순수 유틸 (가장 단순)              |

---

## 사전 확인 사항

### testDb setup.ts 수정 여부

현재 `src/main/__tests__/setup.ts`의 `beforeEach`에 `notes` 테이블 정리 코드가 없다.
그러나 `notes` FK 구조상 아래 이유로 추가 불필요:

```
notes.workspaceId → workspaces (onDelete: cascade)
notes.folderId   → folders    (onDelete: set null)
```

- `folders` 삭제 → notes.folderId = null (set null)
- `workspaces` 삭제 → notes CASCADE 삭제

현재 `beforeEach` 순서 `[tabSnapshots, tabSessions, folders, workspaces]`에서
`workspaces` 삭제 시 `notes`가 cascade 삭제됨 → 격리 보장.

→ **setup.ts 수정 없이 note 테스트 추가 가능**

---

## Success Criteria

- [ ] `fs-utils.test.ts`: `readMdFilesRecursive` 8케이스, `resolveNameConflict` 4케이스
- [ ] `note.test.ts` (repository): 모든 메서드 커버 (findByWorkspaceId, findById, findByRelativePath, create, createMany, update, deleteOrphans, bulkUpdatePathPrefix, reindexSiblings, delete)
- [ ] `note.test.ts` (service): readByWorkspace (folderId 자동결정 포함), create, rename, remove, readContent, writeContent (whitespace 정규화 포함), move (targetFolder not found 포함), updateMeta 전체 케이스
- [ ] `queries.test.ts`: 모든 hook (8개) 커버, `useWriteNoteContent`는 `setQueryData` 검증
- [ ] `use-note-watcher.test.ts`: 구독 등록, invalidation, 비동기 refetch+dispatch, ownWrite 스킵, cleanup 커버
- [ ] `own-write-tracker.test.ts`: markAsOwnWrite, isOwnWrite, 2초 자동 해제, 테스트 간 상태 격리
- [ ] `npm run typecheck` 에러 없음
- [ ] `npm run test` 전체 통과
