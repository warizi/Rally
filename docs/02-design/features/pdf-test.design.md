# Design: PDF 테스트 코드 작성

> 작성일: 2026-03-01
> 기능: pdf-test
> Plan 참조: `docs/01-plan/features/pdf-test.plan.md`

---

## 1. 구현 순서

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `src/main/repositories/__tests__/pdf-file.test.ts` | Repository 테스트 (testDb) |
| 2 | `src/main/services/__tests__/pdf-file.test.ts` | Service 테스트 (vi.mock) |

환경 설정 변경 없음 (`setup.ts` — cascade 삭제로 pdfFiles 자동 정리).

---

## 2. 파일 상세 설계

---

### 파일 1: `src/main/repositories/__tests__/pdf-file.test.ts`

> 패턴 참조: `csv-file.test.ts` (201줄)

#### 2.1.1 import & 픽스처

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { pdfFileRepository, type PdfFileInsert } from '../pdf-file'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb.insert(schema.workspaces).values({
    id: WS_ID, name: 'Test', path: '/test',
    createdAt: new Date(), updatedAt: new Date()
  }).run()
})

function makePdf(overrides?: Partial<PdfFileInsert>): PdfFileInsert {
  return {
    id: 'pdf-1', workspaceId: WS_ID, folderId: null,
    relativePath: 'test.pdf', title: 'test',
    description: '', preview: '', order: 0,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides
  }
}
```

> CSV와 차이: `columnWidths` 필드 없음, 확장자 `.pdf`

#### 2.1.2 테스트 케이스

**findByWorkspaceId** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | pdf 없을 때 빈 배열 반환 | `toEqual([])` |
| 2 | 해당 workspace의 pdf만 반환 | ws-2 생성 후 WS_ID 조회 → `toHaveLength(1)` |

**findById** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 존재하는 id → PdfFile 반환 | `toBeDefined()` |
| 2 | 없는 id → undefined | `toBeUndefined()` |

**findByRelativePath** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 일치 → PdfFile 반환 | `result!.id === 'rp1'` |
| 2 | 불일치 → undefined | `toBeUndefined()` |

**create** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 모든 필드 포함 생성 후 반환 | `row.id`, `row.title`, `row.description`, `row.order` |

**createMany** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 빈 배열 → no-op | `findByWorkspaceId → []` |
| 2 | 여러 건 삽입 | `toHaveLength(2)` |
| 3 | 중복 id → onConflictDoNothing | 기존 유지, 새 행 무시 |

**update** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 지정 필드만 변경 | `title` 변경, `description` 보존 |
| 2 | 없는 id → undefined | `toBeUndefined()` |

**deleteOrphans** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | existingPaths에 없는 pdf 삭제 | keep → `toBeDefined()`, orphan → `toBeUndefined()` |
| 2 | 빈 배열 → 전체 삭제 | `toHaveLength(0)` |
| 3 | 모두 있으면 삭제 없음 | `toHaveLength(2)` |

**bulkDeleteByPrefix** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | prefix 하위만 삭제 | `docs/` 하위 삭제, `other.pdf` 보존 |

**bulkUpdatePathPrefix** (3건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정확히 oldPrefix 일치 → newPrefix | `relativePath === 'new-folder'` |
| 2 | 하위 경로 변경 | `old-folder/a.pdf` → `new-folder/a.pdf` |
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

### 파일 2: `src/main/services/__tests__/pdf-file.test.ts`

> 패턴 참조: `csv-file.test.ts` (361줄)

#### 2.2.1 mock & 픽스처

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import { pdfFileService } from '../pdf-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError } from '../../lib/errors'
import { reindexLeafSiblings } from '../../lib/leaf-reindex'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))
vi.mock('../../repositories/pdf-file', () => ({
  pdfFileRepository: {
    findByWorkspaceId: vi.fn(), findById: vi.fn(),
    findByRelativePath: vi.fn(), create: vi.fn(),
    createMany: vi.fn(), update: vi.fn(),
    deleteOrphans: vi.fn(), delete: vi.fn()
  }
}))
vi.mock('../../repositories/folder', () => ({
  folderRepository: { findById: vi.fn(), findByRelativePath: vi.fn() }
}))
vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir: string, name: string) => name),
  readPdfFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))
```

> CSV와 차이: `chardet`, `iconv-lite` mock 없음. `readPdfFilesRecursive` (not `readCsvFilesRecursive`).

```typescript
const MOCK_WS = { id: 'ws-1', name: 'T', path: '/t', createdAt: new Date(), updatedAt: new Date() }

const MOCK_PDF_ROW = {
  id: 'pdf-1', workspaceId: 'ws-1', folderId: null,
  relativePath: 'test.pdf', title: 'test',
  description: '', preview: '', order: 0,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01')
}

const MOCK_FOLDER = {
  id: 'folder-1', workspaceId: 'ws-1', relativePath: 'docs',
  color: null, order: 0, createdAt: new Date(), updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(pdfFileRepository.findByWorkspaceId).mockReturnValue([MOCK_PDF_ROW])
  vi.mocked(pdfFileRepository.findById).mockReturnValue(MOCK_PDF_ROW)
  vi.mocked(pdfFileRepository.create).mockReturnValue(MOCK_PDF_ROW)
  vi.mocked(pdfFileRepository.update).mockReturnValue(MOCK_PDF_ROW)
})
```

> CSV와 차이: `MOCK_PDF_ROW`에 `columnWidths` 없음.

#### 2.2.2 테스트 케이스

**readByWorkspaceFromDb** (2건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 — PdfFileNode[] 반환 | `findByWorkspaceId` 호출, `result[0].id === 'pdf-1'` |
| 2 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |

**import** (4건) — CSV의 `create`에 대응
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 가져오기 | `fs.copyFileSync` 호출, `repository.create` 호출, `title === 'test'` (.pdf 제거) |
| 2 | folderId 지정 | `folderRepository.findById` 호출, `relativePath`에 `docs/` 포함 |
| 3 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 없는 folderId → NotFoundError | `toThrow(NotFoundError)` |

> CSV `create`와 차이: `fs.writeFileSync` → `fs.copyFileSync`, 빈 이름 기본값 없음 (sourcePath 기반).

**rename** (4건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 이름 변경 | `fs.renameSync` 호출, `update`에 `title: 'newname'`, `relativePath: 'newname.pdf'` |
| 2 | 동일 이름 → 변경 없이 반환 | `renameSync` 미호출, `update` 미호출 |
| 3 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 없는 pdfId → NotFoundError | `toThrow(NotFoundError)` |

**remove** (4건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 삭제 | `fs.unlinkSync` + `repository.delete` 호출 |
| 2 | 외부 삭제 (fs throw) | `delete`만 호출, 에러 무시 |
| 3 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 없는 pdfId → NotFoundError | `toThrow(NotFoundError)` |

**readContent** (4건) — CSV보다 단순
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 정상 — `{ data: Buffer }` 반환 | `fs.readFileSync` 호출, `result.data` 가 `Buffer` |
| 2 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 3 | 없는 pdfId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 파일 읽기 실패 → NotFoundError | `readFileSync` throw → `toThrow(NotFoundError)` |

> CSV 7건 → PDF 4건: 인코딩 감지, BOM, chardet null 분기 없음.

**move** (5건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | 같은 폴더 | `renameSync` 미호출, `update` 미호출, `reindexLeafSiblings` 호출 |
| 2 | 다른 폴더 | `renameSync` + `update(folderId)` + `reindexLeafSiblings` 호출 |
| 3 | 없는 workspaceId → NotFoundError | `toThrow(NotFoundError)` |
| 4 | 없는 pdfId → NotFoundError | `toThrow(NotFoundError)` |
| 5 | 없는 targetFolderId → NotFoundError | `toThrow(NotFoundError)` |

**updateMeta** (2건) — CSV 3건에서 축소
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | description 업데이트 | `update`에 `{ description: '설명' }` 포함 |
| 2 | 없는 pdfId → NotFoundError | `toThrow(NotFoundError)` |

> CSV `columnWidths` 테스트 없음.

**toPdfFileNode Date 변환** (1건)
| # | 설명 | 핵심 assertion |
|---|------|----------------|
| 1 | number → Date 변환 | `toBeInstanceOf(Date)` |

**총 26건**

---

## 3. CSV 대비 차이 요약

| 항목 | CSV 테스트 | PDF 테스트 |
|------|-----------|-----------|
| Repository 케이스 | 21건 | 21건 (동일) |
| Service 케이스 | 30건 | 26건 |
| mock 대상 | chardet, iconv-lite, fs, nanoid | fs, nanoid만 |
| create/import | `writeFileSync` 검증 | `copyFileSync` 검증 |
| readContent | 인코딩/BOM 7건 | 단순 Buffer 4건 |
| writeContent | 3건 | 없음 |
| updateMeta | description + columnWidths 3건 | description만 2건 |

---

## 4. 검증

```bash
npm run test          # Node 테스트 전체 실행
npm run typecheck     # 타입 검증
```
