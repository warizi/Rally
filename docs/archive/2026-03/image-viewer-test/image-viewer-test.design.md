# Design: Image Viewer 테스트 코드 작성

> 작성일: 2026-03-02
> 기능: image-viewer-test
> Plan 참조: `docs/01-plan/features/image-viewer-test.plan.md`

---

## 1. 구현 순서

| 순서 | 파일                                                                                     | 환경 | 설명                       |
| ---- | ---------------------------------------------------------------------------------------- | ---- | -------------------------- |
| 1    | `src/main/repositories/__tests__/image-file.test.ts`                                     | Node | Repository 테스트 (testDb) |
| 2    | `src/main/services/__tests__/image-file.test.ts`                                         | Node | Service 테스트 (vi.mock)   |
| 3    | `src/renderer/src/entities/image-file/model/__tests__/own-write-tracker.test.ts`         | Web  | Fake timer 테스트          |
| 4    | `src/renderer/src/entities/image-file/api/__tests__/queries.test.ts`                     | Web  | React Query hooks 테스트   |
| 5    | `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts` | Web  | image case 1건 추가        |

환경 설정 변경 없음 (`setup.ts` — cascade 삭제로 imageFiles 자동 정리).

---

## 2. 파일 상세 설계

---

### 파일 1: `src/main/repositories/__tests__/image-file.test.ts`

> 패턴 참조: `pdf-file.test.ts` (249줄)

#### 2.1.1 import & 픽스처

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { imageFileRepository, type ImageFileInsert } from '../image-file'

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

function makeImage(overrides?: Partial<ImageFileInsert>): ImageFileInsert {
  return {
    id: 'img-1',
    workspaceId: WS_ID,
    folderId: null,
    relativePath: 'photo.png',
    title: 'photo',
    description: '',
    preview: '',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
```

> PDF와 차이: 확장자 `.png`, 기본 title `'photo'`

#### 2.1.2 테스트 케이스

**findByWorkspaceId** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | image 없을 때 빈 배열 반환 | `toEqual([])` |
| 2 | 해당 workspace의 image만 반환 | ws-2 생성 후 WS_ID 조회 → `toHaveLength(1)` |

**findById** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 존재하는 id → ImageFile 반환 | `toBeDefined()` |
| 2 | 없는 id → undefined | `toBeUndefined()` |

**findByRelativePath** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | workspaceId + relativePath 일치 → ImageFile 반환 | `result!.id === 'rp1'` |
| 2 | 일치 없음 → undefined | `toBeUndefined()` |

**create** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 모든 필드 포함하여 생성 후 반환 | `row.id`, `row.title`, `row.description`, `row.order` |

**createMany** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 빈 배열 → no-op | `findByWorkspaceId → []` |
| 2 | 여러 건 삽입 | `toHaveLength(2)` |
| 3 | 중복 (workspaceId, relativePath) → onConflictDoNothing | 기존 유지, 새 행 무시 |

**update** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 지정 필드만 변경, 나머지 보존 | `title` 변경, `description` 보존 |
| 2 | 없는 id → undefined | `toBeUndefined()` |

**deleteOrphans** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | existingPaths에 없는 image 삭제 | keep → `toBeDefined()`, orphan → `toBeUndefined()` |
| 2 | 빈 배열 → 전체 삭제 | `toHaveLength(0)` |
| 3 | 모두 있으면 삭제 없음 | `toHaveLength(2)` |

**bulkDeleteByPrefix** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | prefix/ 하위 image만 삭제 | `docs/` 하위 삭제, `other.png` 보존 |

**bulkUpdatePathPrefix** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정확히 oldPrefix 일치 → newPrefix | `relativePath === 'new-folder'` |
| 2 | 하위 경로 변경 | `old-folder/a.png` → `new-folder/a.png`, `other/b.png` 보존 |
| 3 | updatedAt 갱신 | `getTime()` 비교 |

**reindexSiblings** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | orderedIds 순서대로 order 재설정 | `ri2.order=0`, `ri1.order=1` |

**delete** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 삭제 후 findById → undefined | `toBeUndefined()` |

**총 21건**

---

### 파일 2: `src/main/services/__tests__/image-file.test.ts`

> 패턴 참조: `pdf-file.test.ts` (291줄)

#### 2.2.1 mock & 픽스처

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import { imageFileService } from '../image-file'
import { imageFileRepository } from '../../repositories/image-file'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { entityLinkService } from '../entity-link'
import { NotFoundError } from '../../lib/errors'
import { getLeafSiblings, reindexLeafSiblings } from '../../lib/leaf-reindex'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))
vi.mock('../../repositories/image-file', () => ({
  imageFileRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    findByRelativePath: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    deleteOrphans: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('../../repositories/folder', () => ({
  folderRepository: { findById: vi.fn(), findByRelativePath: vi.fn() }
}))
vi.mock('../entity-link', () => ({
  entityLinkService: { removeAllLinks: vi.fn() }
}))
vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir: string, name: string) => name),
  readImageFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))
```

> PDF와 차이: `entityLinkService` mock 추가 (`'../entity-link'`), `readImageFilesRecursive` (not `readPdfFilesRecursive`).

```typescript
const MOCK_WS = {
  id: 'ws-1',
  name: 'T',
  path: '/t',
  createdAt: new Date(),
  updatedAt: new Date()
}

const MOCK_IMAGE_ROW = {
  id: 'img-1',
  workspaceId: 'ws-1',
  folderId: null,
  relativePath: 'photo.png',
  title: 'photo',
  description: '',
  preview: '',
  order: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
}

const MOCK_FOLDER = {
  id: 'folder-1',
  workspaceId: 'ws-1',
  relativePath: 'docs',
  color: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(imageFileRepository.findByWorkspaceId).mockReturnValue([MOCK_IMAGE_ROW])
  vi.mocked(imageFileRepository.findById).mockReturnValue(MOCK_IMAGE_ROW)
  vi.mocked(imageFileRepository.create).mockReturnValue(MOCK_IMAGE_ROW)
  vi.mocked(imageFileRepository.update).mockReturnValue(MOCK_IMAGE_ROW)
})
```

#### 2.2.2 테스트 케이스

**readByWorkspaceFromDb** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 — ImageFileNode[] 반환 | `findByWorkspaceId` 호출, `result[0].id === 'img-1'` |
| 2 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |

**import** (5건) — PDF 4건 + order 검증 1건 추가
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 가져오기, title 확장자 제거 | `fs.copyFileSync` 호출, `create({ title: 'photo', relativePath: 'photo.png' })` |
| 2 | folderId 지정 | `folderRepository.findById('folder-1')`, `create({ folderId: 'folder-1', relativePath: 'docs/photo.png' })` |
| 3 | 기존 siblings 있을 때 order=maxOrder+1 | `getLeafSiblings` → `[{ id: 'x', kind: 'image', order: 2 }]` mock, `create({ order: 3 })` |
| 4 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 5 | 없는 folderId → NotFoundError | `toThrow(NotFoundError)` |

> PDF와 차이: title 추출 — `path.basename('photo.png', '.png')` = `'photo'` (동적 확장자 제거)

**rename** (5건) — PDF 4건 + 하위 폴더 1건 추가
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 이름 변경 | `fs.renameSync` 호출, `update('img-1', { title: 'newname', relativePath: 'newname.png' })` |
| 2 | 동일 이름 (trim 후 비교) → 변경 없이 반환 | `renameSync` 미호출, `update` 미호출, `result.id === 'img-1'` |
| 3 | 하위 폴더 내 이미지 rename | `findById` → `{ relativePath: 'docs/photo.png' }`, `update({ relativePath: 'docs/newname.png' })` |
| 4 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 5 | 없는 imageId → NotFoundError | `toThrow(NotFoundError)` |

> PDF와 차이: test 3 — 하위 폴더 경로 유지 검증 (PDF 테스트에 없는 추가 케이스)

**remove** (4건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 삭제, 호출 순서 검증 | `fs.unlinkSync` → `entityLinkService.removeAllLinks('image', 'img-1')` → `repository.delete('img-1')` (순서 검증) |
| 2 | 외부 삭제 (fs throw) | `unlinkSync` throw → `removeAllLinks` + `delete` 모두 호출 |
| 3 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 없는 imageId → NotFoundError | `toThrow(NotFoundError)` |

> PDF와 차이: `entityLinkService.removeAllLinks('image', imageId)` 호출 검증. 첫 번째 인자 `'image'` 문자열 검증 필수.

**순서 검증 패턴** (remove test 1):

```typescript
const callOrder: string[] = []
vi.mocked(fs.unlinkSync).mockImplementation(() => {
  callOrder.push('unlink')
})
vi.mocked(entityLinkService.removeAllLinks).mockImplementation(() => {
  callOrder.push('removeLinks')
})
vi.mocked(imageFileRepository.delete).mockImplementation(() => {
  callOrder.push('delete')
})

imageFileService.remove('ws-1', 'img-1')

expect(callOrder).toEqual(['unlink', 'removeLinks', 'delete'])
expect(entityLinkService.removeAllLinks).toHaveBeenCalledWith('image', 'img-1')
```

**readContent** (4건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 — { data: Buffer } 반환 | `fs.readFileSync` 호출, `result.data` 가 `Buffer` |
| 2 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 3 | 없는 imageId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 파일 읽기 실패 → NotFoundError | `readFileSync` throw → `toThrow(NotFoundError)` |

**move** (6건) — PDF 5건 + 폴더→루트 1건 추가
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 같은 폴더 (null→null) | `renameSync` 미호출, `update` 미호출, `reindexLeafSiblings` 호출 |
| 2 | 루트→폴더 (null→folder-1) | `renameSync` 호출, `update({ folderId: 'folder-1', relativePath: 'docs/photo.png' })`, `reindexLeafSiblings` 호출 |
| 3 | 폴더→루트 (folder-1→null) | `findById` → `{ folderId: 'folder-1', relativePath: 'docs/photo.png' }`, `update({ folderId: null, relativePath: 'photo.png' })` (prefix 없음), `reindexLeafSiblings` 호출 |
| 4 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 5 | 없는 imageId → NotFoundError | `toThrow(NotFoundError)` |
| 6 | 없는 targetFolderId → NotFoundError | `toThrow(NotFoundError)` |

> PDF와 차이: test 3 — 폴더→루트 이동 시 `relativePath`에서 폴더 prefix가 제거되는지 검증

**move test 3 mock setup**:

```typescript
const folderImage = {
  ...MOCK_IMAGE_ROW,
  folderId: 'folder-1',
  relativePath: 'docs/photo.png'
}
vi.mocked(imageFileRepository.findById).mockReturnValue(folderImage)

imageFileService.move('ws-1', 'img-1', null, 0)

expect(imageFileRepository.update).toHaveBeenCalledWith(
  'img-1',
  expect.objectContaining({ folderId: null, relativePath: 'photo.png' })
)
```

**updateMeta** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | description 업데이트 | `update('img-1', { description: '설명', updatedAt: expect.any(Date) })` |
| 2 | 없는 imageId → NotFoundError | `toThrow(NotFoundError)` |

> `_workspaceId` 파라미터는 구현에서 미사용. workspaceId 검증 불필요.

**toImageFileNode Date 변환** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | createdAt/updatedAt number → Date 변환 | `toBeInstanceOf(Date)` |

**총 29건**

---

### 파일 3: `src/renderer/src/entities/image-file/model/__tests__/own-write-tracker.test.ts`

> 패턴 참조: `entities/note/model/__tests__/own-write-tracker.test.ts` (44줄)

#### 2.3.1 import & 설정

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { markAsOwnWrite, isOwnWrite } from '../own-write-tracker'

// 모듈 레벨 Map 사용 → 각 테스트에 고유 ID 사용하여 격리
afterEach(() => {
  vi.useRealTimers()
})
```

#### 2.3.2 테스트 케이스

**markAsOwnWrite + isOwnWrite** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | markAsOwnWrite 후 isOwnWrite → true | `expect(isOwnWrite('unique-id-1')).toBe(true)` |
| 2 | 미호출 id → false | `expect(isOwnWrite('never-marked')).toBe(false)` |

**2초 자동 해제** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 3 | 2초 후 자동 해제 → false | `vi.advanceTimersByTime(2001)` → `toBe(false)` |
| 4 | 2초 이전 → true | `vi.advanceTimersByTime(1999)` → `toBe(true)` |

**타이머 리셋** (1건) — note 테스트에 없는 추가 케이스
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 5 | 같은 id 재호출 시 타이머 리셋 | mark → 1초 후 re-mark → +1999ms 시점 true, +2001ms 시점 false |

**타이머 리셋 test 5 구현**:

```typescript
it('같은 id 재호출 시 타이머가 리셋된다', () => {
  vi.useFakeTimers()
  markAsOwnWrite('unique-id-reset')

  vi.advanceTimersByTime(1000)
  markAsOwnWrite('unique-id-reset') // 1초 후 재호출 → 타이머 리셋

  vi.advanceTimersByTime(1999) // 재호출 시점 기준 1999ms
  expect(isOwnWrite('unique-id-reset')).toBe(true)

  vi.advanceTimersByTime(2) // 총 2001ms → 해제
  expect(isOwnWrite('unique-id-reset')).toBe(false)
})
```

**총 5건**

---

### 파일 4: `src/renderer/src/entities/image-file/api/__tests__/queries.test.ts`

> 패턴 참조: `entities/note/api/__tests__/queries.test.ts` (236줄)

#### 2.4.1 import & mock

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useImageFilesByWorkspace,
  useImportImageFile,
  useRenameImageFile,
  useRemoveImageFile,
  useReadImageContent,
  useMoveImageFile,
  useUpdateImageMeta
} from '../queries'
import type { ImageFileNode } from '../../model/types'

const mockReadByWorkspace = vi.fn()
const mockImport = vi.fn()
const mockRename = vi.fn()
const mockRemove = vi.fn()
const mockReadContent = vi.fn()
const mockMove = vi.fn()
const mockUpdateMeta = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    image: {
      readByWorkspace: mockReadByWorkspace,
      import: mockImport,
      rename: mockRename,
      remove: mockRemove,
      readContent: mockReadContent,
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

#### 2.4.2 헬퍼 & 샘플 데이터

```typescript
function createWrapper(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const SAMPLE_IMAGE: ImageFileNode = {
  id: 'img-1',
  title: 'photo',
  relativePath: 'photo.png',
  description: '',
  preview: '',
  folderId: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

#### 2.4.3 테스트 케이스

**useImageFilesByWorkspace** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 data 반환 | `isSuccess === true`, `data[0].id === 'img-1'` |
| 2 | IPC success:false → error 상태 | `isError === true` |
| 3 | workspaceId="" → queryFn 미호출 | `mockReadByWorkspace` not called (50ms 대기) |

**useImportImageFile** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 invalidate | `invalidateQueries({ queryKey: ['image', 'workspace', 'ws-1'] })` |

> mutate 인자: `{ workspaceId: 'ws-1', folderId: null, sourcePath: '/source/photo.png' }`

**useRenameImageFile** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 invalidate | `invalidateQueries({ queryKey: ['image', 'workspace', 'ws-1'] })` |

> mutate 인자: `{ workspaceId: 'ws-1', imageId: 'img-1', newName: 'renamed' }`

**useRemoveImageFile** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 invalidate | `invalidateQueries({ queryKey: ['image', 'workspace', 'ws-1'] })` |

> mutate 인자: `{ workspaceId: 'ws-1', imageId: 'img-1' }`

**useReadImageContent** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 { data: ArrayBuffer } 반환 | `isSuccess === true`, `data.data` 존재 |
| 2 | workspaceId="" → queryFn 미호출 | `mockReadContent` not called (50ms 대기) |
| 3 | imageId="" → queryFn 미호출 | `mockReadContent` not called (50ms 대기) |

**useMoveImageFile** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 invalidate | `invalidateQueries({ queryKey: ['image', 'workspace', 'ws-1'] })` |

> mutate 인자: `{ workspaceId: 'ws-1', imageId: 'img-1', folderId: null, index: 0 }`

**useUpdateImageMeta** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 성공 시 invalidate | `invalidateQueries({ queryKey: ['image', 'workspace', 'ws-1'] })` |

> mutate 인자: `{ workspaceId: 'ws-1', imageId: 'img-1', data: { description: 'updated' } }`

**총 11건**

---

### 파일 5: `to-tab-options.test.ts` — image case 추가

> 기존 파일에 1건만 추가

```typescript
it("image → type='image', pathname='/folder/image/{id}', title=전달값", () => {
  expect(toTabOptions('image', 'i-1', '사진.png')).toEqual({
    type: 'image',
    pathname: '/folder/image/i-1',
    title: '사진.png'
  })
})
```

**총 1건**

---

## 3. PDF 대비 차이 요약

| 항목              | PDF 테스트                         | Image 테스트                                           |
| ----------------- | ---------------------------------- | ------------------------------------------------------ |
| Repository 케이스 | 21건                               | 21건 (동일)                                            |
| Service 케이스    | 26건                               | 29건 (+3건)                                            |
| Renderer 케이스   | 없음                               | 17건 (own-write-tracker + queries + to-tab-options)    |
| mock 대상         | fs, nanoid, fs-utils, leaf-reindex | + entityLinkService (`'../entity-link'`)               |
| import            | `copyFileSync`, title `.pdf` 제거  | `copyFileSync`, title 동적 확장자 제거                 |
| remove            | `unlinkSync` + `delete`            | `unlinkSync` + `removeAllLinks` + `delete` (순서 검증) |
| move              | 5건 (같은/다른 폴더)               | 6건 (+폴더→루트)                                       |
| rename            | 4건                                | 5건 (+하위 폴더 경로 유지)                             |
| own-write-tracker | 없음                               | 5건 (타이머 리셋 포함)                                 |
| queries           | 없음                               | 11건 (7 hooks)                                         |

---

## 4. 총 케이스 집계

| 파일                  | 건수   |
| --------------------- | ------ |
| [1] Repository        | 21     |
| [2] Service           | 29     |
| [3] own-write-tracker | 5      |
| [4] queries           | 11     |
| [5] to-tab-options    | 1      |
| **합계**              | **67** |

---

## 5. 검증

```bash
npm run test          # Node 테스트 (repository + service)
npm run test:web      # Renderer 테스트 (own-write-tracker + queries + to-tab-options)
npm run typecheck     # 타입 검증
```
