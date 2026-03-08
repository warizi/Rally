# Plan: Image Viewer 테스트 코드 작성

> 작성일: 2026-03-02
> 기능: image-viewer-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

Image 파일 관리 기능은 이미 구현 완료되어 있으나 테스트 코드가 없는 상태이다.
기존 PDF 테스트 패턴(repository/service/queries/own-write-tracker/to-tab-options)을 따라 신뢰성을 확보한다.

Image는 PDF와 대부분 동일한 구조이나:

- `selectFile`이 `string[]` 반환 (PDF는 `string | null`)
- `readContent`는 `{ data: Buffer }` 반환 (PDF와 동일)
- `writeContent` 없음 (이미지는 읽기 전용)
- 동적 title 추출: `path.basename(name, path.extname(name))` (PDF는 `.replace(/\.pdf$/, '')`)
- `remove`시 `entityLinkService.removeAllLinks('image', imageId)` 호출

---

## 2. 테스트 파일 목록

### Main Process — `vitest.config.node.mts` (`npm run test`)

| #   | 파일                                                 | 비고                           |
| --- | ---------------------------------------------------- | ------------------------------ |
| A   | `src/main/repositories/__tests__/image-file.test.ts` | testDb (in-memory SQLite) 사용 |
| B   | `src/main/services/__tests__/image-file.test.ts`     | repository + fs 전체 vi.mock   |

### Renderer — `vitest.config.web.mts` (`npm run test:web`)

| #   | 파일                                                                                     | 비고                          |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| C   | `src/renderer/src/entities/image-file/model/__tests__/own-write-tracker.test.ts`         | fake timer 사용               |
| D   | `src/renderer/src/entities/image-file/api/__tests__/queries.test.ts`                     | window.api mock + QueryClient |
| E   | `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts` | image case 추가               |

> ⚠️ Node 환경 `globals: false` → `describe`, `it`, `expect`, `vi` 명시적 import 필수
> ⚠️ Web 환경은 `globals: true` 이지만 일관성을 위해 vitest import 유지

---

## 3. 환경 설정

### `src/main/__tests__/setup.ts` — **수정 불필요**

`imageFiles`도 `workspaceId → workspaces.id (onDelete: cascade)` 이므로 workspaces 삭제 시 자동 cascade 삭제된다.

---

## 4. 테스트 케이스 상세

---

### [A] imageFileRepository

**픽스처 헬퍼 패턴** (pdf-file.test.ts 참조):

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

#### findByWorkspaceId

| #   | 설명                                         |
| --- | -------------------------------------------- |
| 1   | image 없을 때 빈 배열 반환                   |
| 2   | 해당 workspace의 image만 반환 (다른 ws 제외) |

#### findById

| #   | 설명                         |
| --- | ---------------------------- |
| 1   | 존재하는 id → ImageFile 반환 |
| 2   | 없는 id → undefined          |

#### findByRelativePath

| #   | 설명                                             |
| --- | ------------------------------------------------ |
| 1   | workspaceId + relativePath 일치 → ImageFile 반환 |
| 2   | 일치 없음 → undefined                            |

#### create

| #   | 설명                            |
| --- | ------------------------------- |
| 1   | 모든 필드 포함하여 생성 후 반환 |

#### createMany

| #   | 설명                                                |
| --- | --------------------------------------------------- |
| 1   | 빈 배열 → no-op                                     |
| 2   | 여러 건 삽입 후 findByWorkspaceId로 확인            |
| 3   | 중복 relativePath → onConflictDoNothing (에러 없음) |

#### update

| #   | 설명                          |
| --- | ----------------------------- |
| 1   | 지정 필드만 변경, 나머지 보존 |
| 2   | 없는 id → undefined           |

#### deleteOrphans

| #   | 설명                                  |
| --- | ------------------------------------- |
| 1   | existingPaths에 없는 image 삭제       |
| 2   | existingPaths 빈 배열 → 전체 삭제     |
| 3   | 모두 existingPaths에 있으면 삭제 없음 |

#### bulkDeleteByPrefix

| #   | 설명                                      |
| --- | ----------------------------------------- |
| 1   | prefix 일치하는 image만 삭제, 나머지 보존 |

#### bulkUpdatePathPrefix

| #   | 설명                                                |
| --- | --------------------------------------------------- |
| 1   | 정확히 oldPrefix와 일치하는 경로 → newPrefix로 변경 |
| 2   | oldPrefix/ 하위 경로 → newPrefix/ 하위로 변경       |
| 3   | updatedAt 갱신 확인                                 |

#### reindexSiblings

| #   | 설명                             |
| --- | -------------------------------- |
| 1   | orderedIds 순서대로 order 재설정 |

#### delete

| #   | 설명                         |
| --- | ---------------------------- |
| 1   | 삭제 후 findById → undefined |

---

### [B] imageFileService

**Mock 구조** (pdf-file.test.ts 참조):

```typescript
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
  resolveNameConflict: vi.fn((_dir, name) => name),
  readImageFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))
```

#### readByWorkspaceFromDb

| #   | 설명                                           |
| --- | ---------------------------------------------- |
| 1   | 정상 — repository 호출 후 ImageFileNode[] 반환 |
| 2   | 없는 workspaceId → NotFoundError               |

#### import

| #   | 설명                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | 정상 가져오기 — fs.copyFileSync + repository.create 호출, **title이 확장자 제거된 값** (예: `photo.png` → `title: 'photo'`) |
| 2   | folderId 지정 — folderRepository.findById 호출, 경로에 폴더 포함                                                            |
| 3   | 기존 siblings 있을 때 — **order = maxOrder + 1** (`getLeafSiblings` 반환값 기반)                                            |
| 4   | 없는 workspaceId → NotFoundError                                                                                            |
| 5   | 없는 folderId → NotFoundError                                                                                               |

> PDF와 차이: title 추출 방식 — `path.basename(name, path.extname(name))`으로 어떤 확장자든 동적 제거

#### rename

| #   | 설명                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------- |
| 1   | 정상 이름 변경 — fs.renameSync + repository.update 호출                                                  |
| 2   | 동일 이름 (trim 후 비교) → 변경 없이 기존 객체 반환                                                      |
| 3   | **하위 폴더 내 이미지** rename — `relativePath='docs/photo.png'`일 때 `'docs/newname.png'`으로 경로 유지 |
| 4   | 없는 workspaceId → NotFoundError                                                                         |
| 5   | 없는 imageId → NotFoundError                                                                             |

#### remove

| #   | 설명                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | 정상 삭제 — fs.unlinkSync → **entityLinkService.removeAllLinks('image', imageId)** → repository.delete 호출 (순서+인자 검증) |
| 2   | 외부 삭제 (fs 에러) — fs 에러 무시 후 entityLinkService.removeAllLinks + repository.delete 호출                              |
| 3   | 없는 workspaceId → NotFoundError                                                                                             |
| 4   | 없는 imageId → NotFoundError                                                                                                 |

> PDF와 차이: `remove`시 `entityLinkService.removeAllLinks('image', imageId)` 추가 호출. 첫 번째 인자 `'image'` 검증 필수

#### readContent

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 정상 — fs.readFileSync 호출 후 { data: Buffer } 반환   |
| 2   | 없는 workspaceId → NotFoundError                       |
| 3   | 없는 imageId → NotFoundError                           |
| 4   | 파일 읽기 실패 (fs.readFileSync throw) → NotFoundError |

#### move

| #   | 설명                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 같은 폴더 이동 (null→null) — fs.renameSync 미호출, reindexLeafSiblings만 호출                                                                     |
| 2   | 루트→폴더 이동 (null→folder-1) — fs.renameSync + repository.update(folderId 변경) + reindexLeafSiblings 호출                                      |
| 3   | **폴더→루트 이동 (folder-1→null)** — fs.renameSync + repository.update(folderId=null, relativePath에 폴더 prefix 없음) + reindexLeafSiblings 호출 |
| 4   | 없는 workspaceId → NotFoundError                                                                                                                  |
| 5   | 없는 imageId → NotFoundError                                                                                                                      |
| 6   | 없는 targetFolderId → NotFoundError                                                                                                               |

> Case 3은 PDF 테스트에 없는 **Image 고유 추가 케이스**. `targetFolderRel=null`일 때 `finalRel = finalFileName` (prefix 없이 루트 경로)

#### updateMeta

| #   | 설명                                          |
| --- | --------------------------------------------- |
| 1   | description 업데이트 — repository.update 호출 |
| 2   | 없는 imageId → NotFoundError                  |

> 참고: `updateMeta`의 `_workspaceId` 파라미터는 구현에서 미사용 (`_` prefix). workspaceId 검증 테스트 불필요.

#### toImageFileNode Date 변환

| #   | 설명                                                 |
| --- | ---------------------------------------------------- |
| 1   | createdAt/updatedAt number → Date 인스턴스 변환 확인 |

---

### [C] own-write-tracker (Renderer)

**패턴**: `entities/note/model/__tests__/own-write-tracker.test.ts` 기반 + 엣지 케이스 보강

| #   | 설명                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- |
| 1   | markAsOwnWrite 후 isOwnWrite → true                                                                         |
| 2   | markAsOwnWrite 미호출 id → false                                                                            |
| 3   | 2초 후 자동 해제 → false (fake timer)                                                                       |
| 4   | 2초 이전 → true (fake timer)                                                                                |
| 5   | **타이머 리셋** — 1초 후 같은 id로 재호출 시 카운트다운 리셋 (1초+1999ms 시점에도 true, 1초+2001ms에 false) |

> Case 5는 note 테스트에 없는 추가 엣지 케이스. 코드의 `clearTimeout(prev)` + 새 타이머 설정 동작 검증

---

### [D] queries (Renderer)

**패턴**: `entities/note/api/__tests__/queries.test.ts` 와 동일

**window.api mock**:

```typescript
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

#### useImageFilesByWorkspace

| #   | 설명                                            |
| --- | ----------------------------------------------- |
| 1   | 성공 시 data 반환                               |
| 2   | IPC success:false → error 상태                  |
| 3   | workspaceId="" → queryFn 미호출 (enabled=false) |

#### useImportImageFile

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 성공 시 ["image", "workspace", workspaceId] invalidate |

#### useRenameImageFile

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 성공 시 ["image", "workspace", workspaceId] invalidate |

#### useRemoveImageFile

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 성공 시 ["image", "workspace", workspaceId] invalidate |

#### useReadImageContent

| #   | 설명                                            |
| --- | ----------------------------------------------- |
| 1   | 성공 시 { data: ArrayBuffer } 반환              |
| 2   | workspaceId="" → queryFn 미호출 (enabled=false) |
| 3   | imageId="" → queryFn 미호출 (enabled=false)     |

#### useMoveImageFile

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 성공 시 ["image", "workspace", workspaceId] invalidate |

#### useUpdateImageMeta

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 성공 시 ["image", "workspace", workspaceId] invalidate |

---

### [E] to-tab-options — image case 추가

**기존 파일**: `features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts`

| #   | 설명                                                                      |
| --- | ------------------------------------------------------------------------- |
| 1   | `image` → `type='image'`, `pathname='/folder/image/{id}'`, `title=전달값` |

> 기존 테스트 파일에 1개 테스트 케이스만 추가

---

## 5. 검증

```bash
npm run test          # Node 테스트 (repository + service)
npm run test:web      # Renderer 테스트 (own-write-tracker + queries + to-tab-options)
```

---

## 6. PDF 대비 차이 요약

| 항목          | PDF                        | Image                                                |
| ------------- | -------------------------- | ---------------------------------------------------- |
| 생성          | `import` (fs.copyFileSync) | `import` (fs.copyFileSync) — 동일                    |
| Title 추출    | `.replace(/\.pdf$/, '')`   | `path.basename(name, path.extname(name))`            |
| 내용 읽기     | 단순 Buffer 반환           | 단순 Buffer 반환 — 동일                              |
| 내용 쓰기     | 없음 (읽기 전용)           | 없음 (읽기 전용) — 동일                              |
| 삭제          | repository.delete          | entityLinkService.removeAllLinks + repository.delete |
| 메타 업데이트 | description만              | description만 — 동일                                 |
| selectFile    | `string \| null`           | `string[]` (multi-select)                            |

## 7. 주의사항

- 서비스의 `readByWorkspace` (full fs scan + lazy upsert + 이동 감지)는 분기가 복잡하여 이번 plan에서 제외. 향후 별도 통합 테스트로 추가 가능.
- `bulkUpdatePathPrefix`, `bulkDeleteByPrefix`는 raw SQL 사용 — repository 테스트에서 직접 DB 검증.
- `entityLinkService.removeAllLinks` mock은 service 테스트에서 별도 vi.mock 필요.
