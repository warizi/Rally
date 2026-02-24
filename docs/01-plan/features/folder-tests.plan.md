# Folder Test Code Plan

## Overview

구현 완료된 폴더 기능(`src/main/repositories/folder.ts`, `src/main/services/folder.ts`, `src/renderer/src/entities/folder/api/queries.ts`)에 대한 테스트 코드를 작성한다.

현재 폴더 기능 전체에 테스트 코드 **0개**. 비즈니스 로직이 복잡한 레이어(bulk path update, reindex, move 순환참조 방지 등)를 우선 검증한다.

## 테스트 레이어별 범위

### Layer 1: folderRepository (Main/Node)

**파일**: `src/main/repositories/__tests__/folder.test.ts`
**환경**: vitest node, `testDb` (in-memory SQLite)
**의존**: `src/main/__tests__/setup.ts` (v1.1: `schema.folders` cleanup 포함됨)

**FK 의존성 설정**: `folders.workspaceId`는 `workspaces.id`를 참조하므로, 각 테스트 시작 전 workspace row를 삽입해야 한다.

```typescript
import '../../__tests__/setup' // testDb, vi.mock('../db')
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { folderRepository } from '../folder'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test',
      path: '/test',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})
```

`setup.ts`의 `beforeEach`가 `workspaces`를 먼저 삭제하고 나면 위 insert가 매번 새로 실행된다.

| 메서드                 | 테스트 케이스                                                               |
| ---------------------- | --------------------------------------------------------------------------- |
| `findByWorkspaceId`    | 빈 결과, 여러 폴더 반환                                                     |
| `findById`             | 존재하는 id, 없는 id → undefined                                            |
| `findByRelativePath`   | 정확히 일치, 없는 경로 → undefined                                          |
| `create`               | 정상 생성, 반환값 검증                                                      |
| `createMany`           | 빈 배열, 여러 항목 일괄 insert                                              |
| `update`               | color 변경, order 변경, 없는 id → undefined                                 |
| `bulkUpdatePathPrefix` | "a"→"a2": "a", "a/b", "a/b/c" 업데이트, "ab" 같은 substring 경로는 보존     |
| `bulkDeleteByPrefix`   | prefix "a" 삭제 시 "a", "a/b", "a/b/c" 전체 삭제, 무관한 경로 보존          |
| `deleteOrphans`        | existingPaths에 없는 row만 삭제, **빈 배열** 전달 시 워크스페이스 전체 삭제 |
| `reindexSiblings`      | orderedIds 순서대로 order 0,1,2,... 재할당, **빈 배열** no-op               |
| `delete`               | 단건 삭제                                                                   |

**복잡도 높은 케이스**:

- `bulkUpdatePathPrefix`:
  - 기본: "a"→"x" 후 "a", "a/b", "a/b/c" → "x", "x/b", "x/b/c" 검증
  - 경계: "ab" 경로는 prefix "a"를 변경해도 영향받지 않음 (SQL `LIKE 'a/%'` 조건)
- `deleteOrphans`:
  - 정상: DB ["a","a/b","a/c"], fs ["a","a/b"] → "a/c" 삭제, "a","a/b" 보존
  - 빈 배열: existingPaths=[] → 워크스페이스 모든 폴더 삭제 (all-delete 의도적 동작)
- `reindexSiblings`:
  - 정상: ["id-c","id-a","id-b"] → order 0,1,2 할당 (역순 포함)
  - 빈 배열: orderedIds=[] → DB 변경 없음 (no-op)

### Layer 2: folderService (Main/Node)

**파일**: `src/main/services/__tests__/folder.test.ts`
**환경**: vitest node, `testDb` + `vi.mock('fs')` + `vi.mock('../../repositories/workspace')`
**의존**: Node.js fs 모듈 mock

> **전략**: `folderRepository`는 mock하지 않고 실제 `testDb` 사용 (lazy upsert 등 통합 동작 검증).
> `workspaceRepository`는 workspace.test.ts 패턴과 동일하게 `vi.mock()`으로 격리.
> `vi.mock()`은 vitest가 자동 호이스팅하므로 import 문 순서와 무관하게 파일 최상단에서 동작.

**파일 상단 설정**:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { folderService } from '../folder'
import { workspaceRepository } from '../../repositories/workspace'
import type { Workspace } from '../../repositories/workspace'
import { NotFoundError, ValidationError } from '../../lib/errors'

// vitest가 자동 호이스팅 — 실제 fs 모듈 전체 mock
vi.mock('fs')

// workspace mock (workspace.test.ts와 동일 패턴)
vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

// fs.Dirent mock 헬퍼 (withFileTypes: true로 호출 → isSymbolicLink/isDirectory 메서드 필요)
function makeDirent(name: string, isDir = true): fs.Dirent {
  return {
    name,
    isSymbolicLink: () => false,
    isDirectory: () => isDir
  } as unknown as fs.Dirent
}

const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'Test',
  path: '/test/workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
  // ⚠️ accessSync 기본값은 ENOENT throw (경로 없음 = 사용 가능)
  // resolveNameConflict: accessSync 성공 → 충돌, throw → 사용 가능
  // mockReturnValue(undefined)로 설정하면 모든 경로가 "존재"로 판단 → 무한 루프 발생
  vi.mocked(fs.accessSync).mockImplementation(() => {
    throw new Error('ENOENT: no such file')
  })
  vi.mocked(fs.readdirSync).mockReturnValue([])
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
  vi.mocked(fs.renameSync).mockReturnValue(undefined)
  vi.mocked(fs.rmSync).mockReturnValue(undefined)
})
// 이름 충돌 테스트: accessSync를 순차적으로 제어해야 함
// it('충돌 시 "(1)" suffix', async () => {
//   vi.mocked(fs.accessSync)
//     .mockImplementationOnce(() => {})           // 첫 번째 경로 존재 → 충돌
//     .mockImplementationOnce(() => { throw ... }) // "(1)" 경로 없음 → 사용 가능
// })
```

| 메서드             | 테스트 케이스                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `readDirRecursive` | 빈 디렉토리, 중첩 폴더, symlink 제외, `.` 시작 폴더 제외, `readdirSync` throw 시 빈 배열 반환                    |
| `readTree`         | fs 폴더가 DB에 없으면 lazy upsert, DB에만 있는 orphan 삭제, 트리 구조 반환                                       |
| `readTree` (에러)  | workspace 없음 → NotFoundError, 경로 접근 불가 → ValidationError                                                 |
| `create`           | 루트 생성, 하위 생성, 이름 충돌 시 "(1)" suffix, 동일 충돌 반복 시 "(2)" "(3)" 순서, parent 없음 → NotFoundError |
| `rename`           | 정상 rename, 같은 이름 no-op, 하위 전체 경로 업데이트 검증 ("a"→"x" 시 "a/b"→"x/b" 확인)                         |
| `remove`           | fs.rmSync 호출, DB row 삭제 확인                                                                                 |
| `move`             | 다른 부모로 이동 + siblings reindex, 같은 부모 내 reorder                                                        |
| `move` (에러)      | 자기 자신 하위로 이동 → ValidationError                                                                          |
| `updateMeta`       | color 변경, order 변경, 없는 id → NotFoundError                                                                  |

**핵심 비즈니스 로직 케이스**:

- `readTree` lazy upsert: fs 3개 폴더, DB 1개 → 나머지 2개 insert 후 tree 반환
- `move` 순환 참조: "a"를 "a/b" 하위로 이동 시도 → ValidationError
- `rename` 하위 전체: "a"를 "x"로 rename → "a/b", "a/b/c" 모두 "x/b", "x/b/c"로 업데이트

### Layer 3: React Query Hooks (Renderer/Web)

**파일**: `src/renderer/src/entities/folder/api/__tests__/queries.test.ts`
**환경**: vitest web (happy-dom), window.api IPC mock

**IPC mock 구조**:

```typescript
const mockReadTree = vi.fn()
const mockCreate = vi.fn()
const mockRename = vi.fn()
const mockRemove = vi.fn()
const mockMove = vi.fn()
const mockUpdateMeta = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    folder: {
      readTree: mockReadTree,
      create: mockCreate,
      rename: mockRename,
      remove: mockRemove,
      move: mockMove,
      updateMeta: mockUpdateMeta
    }
  }
  vi.clearAllMocks()
})
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})
```

| Hook                  | 테스트 케이스                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `useFolderTree`       | 성공 시 data 반환, IPC 에러 시 error 상태, **workspaceId=""이면 queryFn 미호출** (enabled=false) |
| `useCreateFolder`     | onSuccess 시 queryKey invalidate                                                                 |
| `useRenameFolder`     | onSuccess 시 queryKey invalidate                                                                 |
| `useRemoveFolder`     | onSuccess 시 queryKey invalidate                                                                 |
| `useMoveFolder`       | onSuccess 시 queryKey invalidate                                                                 |
| `useUpdateFolderMeta` | onSuccess 시 queryKey invalidate                                                                 |

**주요 검증 포인트**:

- IPC 응답 `{ success: false, errorType, message }` 시 `throwIpcError` 호출되어 error 상태
- mutation onSuccess 후 `['folder', 'tree', workspaceId]` queryKey invalidation 발생
- `useFolderTree(workspaceId="")` → `enabled: false` → `mockReadTree` 미호출 검증

**Import 전략**:

```typescript
import { useFolderTree, useCreateFolder, ... } from '../queries'   // 직접 import
import type { FolderNode } from '../model/types'
import type { IpcResponse } from '@shared/types/ipc'
```

**invalidation 검증 패턴** (queryClient spy 사용):

```typescript
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

it('useCreateFolder onSuccess 시 tree queryKey invalidate', async () => {
  const { queryClient, wrapper } = createWrapper()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

  mockCreate.mockResolvedValue({ success: true, data: { id: 'f1', name: 'new', ... } })

  const { result } = renderHook(() => useCreateFolder(), { wrapper })
  act(() => result.current.mutate({ workspaceId: 'ws-1', parentFolderId: null, name: 'new' }))

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
})
```

## 구현 순서

```
1. folderRepository.test.ts   (Layer 1 — 의존성 최소, 빠른 확인)
2. folder.service.test.ts     (Layer 2 — fs mock 설계 핵심)
3. queries.test.ts            (Layer 3 — 기존 패턴 동일, 빠름)
```

## 테스트 헬퍼 패턴

```typescript
// Repository 테스트용 픽스처
function makeFolder(overrides?: Partial<FolderInsert>): FolderInsert {
  return {
    id: 'folder-1',
    workspaceId: 'ws-1',
    relativePath: 'a',
    color: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// Service 테스트용 workspace mock (Workspace 타입 전체 필드 명시)
const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'Test',
  path: '/test/workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}
vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
```

## 비범위 (Out of Scope)

- `folder-watcher.ts` 테스트: `@parcel/watcher` native addon mock 복잡도 높음 → 별도 플랜
- UI 컴포넌트 테스트 (FolderTree, FolderNameDialog 등): e2e 성격 강함 → 별도 플랜
- IPC handler 통합 테스트: service mock 복잡 → 별도 플랜

## Success Criteria

- [ ] `folderRepository` 메서드 전체 커버 (11개 메서드)
- [ ] `bulkUpdatePathPrefix` 하위 전체 업데이트 + "ab" substring 경계 케이스 검증
- [ ] `bulkDeleteByPrefix` 관련 없는 row 보존 검증
- [ ] `deleteOrphans` 빈 배열 → all-delete 동작 검증
- [ ] `reindexSiblings` order 재할당 + 빈 배열 no-op 검증
- [ ] `folderService.readTree` lazy upsert + orphan 삭제 검증
- [ ] `folderService.move` 순환 참조 방지 검증
- [ ] `folderService.rename` 하위 전체 경로 업데이트 검증
- [ ] React Query hooks IPC 에러 처리 검증
- [ ] React Query hooks onSuccess queryKey invalidation 검증
- [ ] `useFolderTree` workspaceId="" 시 query 비활성화 (enabled=false) 검증
- [ ] `npm run test` 전체 통과
- [ ] TypeScript 컴파일 에러 없음
