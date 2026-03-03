# Plan: PDF 테스트 코드 작성

> 작성일: 2026-03-01
> 기능: pdf-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

PDF 파일 관리 기능은 이미 구현 완료되어 있으나 테스트 코드가 없는 상태이다.
기존 CSV 테스트 패턴(repository/service)을 그대로 따라 신뢰성을 확보한다.

PDF는 CSV와 달리:

- `create` 대신 `import` (외부 파일을 workspace로 `fs.copyFileSync`)
- `readContent`는 인코딩 감지 없이 `{ data: Buffer }` 반환
- `writeContent` 없음 (PDF는 읽기 전용)
- `chardet`/`iconv-lite` 의존성 없음

---

## 2. 테스트 파일 목록

### Main Process — `vitest.config.node.mts` (`npm run test`)

| 파일                                               | 비고                           |
| -------------------------------------------------- | ------------------------------ |
| `src/main/repositories/__tests__/pdf-file.test.ts` | testDb (in-memory SQLite) 사용 |
| `src/main/services/__tests__/pdf-file.test.ts`     | repository + fs 전체 vi.mock   |

> ⚠️ Node 환경은 `globals: false` → `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import

---

## 3. 환경 설정

### `src/main/__tests__/setup.ts` — **수정 필요**

현재 `beforeEach`에서 `csvFiles` 테이블 정리가 없지만 cascade로 처리되고 있음.
`pdfFiles`도 동일하게 `workspaceId → workspaces.id (onDelete: cascade)` 이므로 workspaces 삭제 시 자동 cascade 삭제된다.

**수정 불필요** — workspaces 삭제 시 pdfFiles가 자동 cascade 삭제됨.

---

## 4. 테스트 케이스 상세

---

### [A] pdfFileRepository

**픽스처 헬퍼 패턴**:

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { pdfFileRepository, type PdfFileInsert } from '../pdf-file'

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

function makePdf(overrides?: Partial<PdfFileInsert>): PdfFileInsert {
  return {
    id: 'pdf-1',
    workspaceId: WS_ID,
    folderId: null,
    relativePath: 'test.pdf',
    title: 'test',
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

| #   | 설명                                       |
| --- | ------------------------------------------ |
| 1   | pdf 없을 때 빈 배열 반환                   |
| 2   | 해당 workspace의 pdf만 반환 (다른 ws 제외) |

#### findById

| #   | 설명                       |
| --- | -------------------------- |
| 1   | 존재하는 id → PdfFile 반환 |
| 2   | 없는 id → undefined        |

#### findByRelativePath

| #   | 설명                                           |
| --- | ---------------------------------------------- |
| 1   | workspaceId + relativePath 일치 → PdfFile 반환 |
| 2   | 일치 없음 → undefined                          |

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
| 1   | existingPaths에 없는 pdf 삭제         |
| 2   | existingPaths 빈 배열 → 전체 삭제     |
| 3   | 모두 existingPaths에 있으면 삭제 없음 |

#### bulkDeleteByPrefix

| #   | 설명                                    |
| --- | --------------------------------------- |
| 1   | prefix 일치하는 pdf만 삭제, 나머지 보존 |

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

### [B] pdfFileService

**Mock 구조**:

```typescript
vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))
vi.mock('../../repositories/pdf-file', () => ({
  pdfFileRepository: {
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
vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir, name) => name),
  readPdfFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))
```

> CSV와 차이: `chardet`, `iconv-lite` mock 없음

#### readByWorkspaceFromDb

| #   | 설명                                         |
| --- | -------------------------------------------- |
| 1   | 정상 — repository 호출 후 PdfFileNode[] 반환 |
| 2   | 없는 workspaceId → NotFoundError             |

#### import

| #   | 설명                                                             |
| --- | ---------------------------------------------------------------- |
| 1   | 정상 가져오기 — fs.copyFileSync + repository.create 호출         |
| 2   | folderId 지정 — folderRepository.findById 호출, 경로에 폴더 포함 |
| 3   | 없는 workspaceId → NotFoundError                                 |
| 4   | 없는 folderId → NotFoundError                                    |

#### rename

| #   | 설명                                                    |
| --- | ------------------------------------------------------- |
| 1   | 정상 이름 변경 — fs.renameSync + repository.update 호출 |
| 2   | 동일 이름 (trim 후 비교) → 변경 없이 기존 객체 반환     |
| 3   | 없는 workspaceId → NotFoundError                        |
| 4   | 없는 pdfId → NotFoundError                              |

#### remove

| #   | 설명                                                       |
| --- | ---------------------------------------------------------- |
| 1   | 정상 삭제 — fs.unlinkSync + repository.delete 호출         |
| 2   | 외부 삭제 (fs 에러) — repository.delete만 호출 (에러 무시) |
| 3   | 없는 workspaceId → NotFoundError                           |
| 4   | 없는 pdfId → NotFoundError                                 |

#### readContent

| #   | 설명                                                   |
| --- | ------------------------------------------------------ |
| 1   | 정상 — fs.readFileSync 호출 후 { data: Buffer } 반환   |
| 2   | 없는 workspaceId → NotFoundError                       |
| 3   | 없는 pdfId → NotFoundError                             |
| 4   | 파일 읽기 실패 (fs.readFileSync throw) → NotFoundError |

> CSV와 차이: 인코딩 감지/BOM 처리 없음. 단순 Buffer 반환.

#### move

| #   | 설명                                                                          |
| --- | ----------------------------------------------------------------------------- |
| 1   | 같은 폴더 이동 — fs.renameSync 미호출, reindexLeafSiblings만 호출             |
| 2   | 다른 폴더 이동 — fs.renameSync + repository.update + reindexLeafSiblings 호출 |
| 3   | 없는 workspaceId → NotFoundError                                              |
| 4   | 없는 pdfId → NotFoundError                                                    |
| 5   | 없는 targetFolderId → NotFoundError                                           |

#### updateMeta

| #   | 설명                                          |
| --- | --------------------------------------------- |
| 1   | description 업데이트 — repository.update 호출 |
| 2   | 없는 pdfId → NotFoundError                    |

> CSV와 차이: columnWidths 없음. description만 업데이트.

#### toPdfFileNode Date 변환

| #   | 설명                                                 |
| --- | ---------------------------------------------------- |
| 1   | createdAt/updatedAt number → Date 인스턴스 변환 확인 |

---

## 5. 검증

```bash
npm run test          # Node 테스트 (repository + service)
```

---

## 6. CSV 대비 차이 요약

| 항목          | CSV                         | PDF                        |
| ------------- | --------------------------- | -------------------------- |
| 생성          | `create` (fs.writeFileSync) | `import` (fs.copyFileSync) |
| 내용 읽기     | 인코딩 감지 + iconv 디코딩  | 단순 Buffer 반환           |
| 내용 쓰기     | `writeContent` 있음         | 없음 (읽기 전용)           |
| 외부 의존     | chardet, iconv-lite         | 없음                       |
| 메타 업데이트 | description + columnWidths  | description만              |

## 7. 주의사항

- 서비스의 `readByWorkspace` (full fs scan + lazy upsert + 이동 감지)는 분기가 복잡하여 이번 plan에서 제외. 향후 별도 통합 테스트로 추가 가능.
- `bulkUpdatePathPrefix`, `bulkDeleteByPrefix`는 raw SQL 사용 — repository 테스트에서 직접 DB 검증.
