# Plan: CSV 테스트 코드 작성

> 작성일: 2026-03-01
> 기능: csv-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

CSV 파일 관리 기능은 이미 구현 완료되어 있으나 테스트 코드가 없는 상태이다.
기존 코드베이스의 테스트 패턴(repository/service)을 따라 신뢰성을 확보한다.

서비스 레이어는 `fs`, `chardet`, `iconv-lite` 등 외부 모듈에 의존하므로
모든 외부 의존성을 vi.mock 처리하여 순수 비즈니스 로직만 검증한다.

---

## 2. 테스트 파일 목록

### Main Process — `vitest.config.node.mts` (`npm run test`)

| 파일 | 비고 |
|------|------|
| `src/main/repositories/__tests__/csv-file.test.ts` | testDb (in-memory SQLite) 사용 |
| `src/main/services/__tests__/csv-file.test.ts` | repository + fs + chardet + iconv 전체 vi.mock |

> ⚠️ Node 환경은 `globals: false` → `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import

---

## 3. 환경 설정

### `src/main/__tests__/setup.ts` — **수정 불필요**

`csvFiles.workspaceId → workspaces.id (onDelete: cascade)` 이므로 workspaces 삭제 시
csvFiles가 자동 cascade 삭제된다.

---

## 4. 테스트 케이스 상세

---

### [A] csvFileRepository

**픽스처 헬퍼 패턴**:
```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { csvFileRepository, type CsvFileInsert } from '../csv-file'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb.insert(schema.workspaces).values({
    id: WS_ID, name: 'Test', path: '/test',
    createdAt: new Date(), updatedAt: new Date()
  }).run()
})

function makeCsv(overrides?: Partial<CsvFileInsert>): CsvFileInsert {
  return {
    id: 'csv-1', workspaceId: WS_ID, folderId: null,
    relativePath: 'test.csv', title: 'test',
    description: '', preview: '', order: 0,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides
  }
}
```

#### findByWorkspaceId
| # | 설명 |
|---|------|
| 1 | csv 없을 때 빈 배열 반환 |
| 2 | 해당 workspace의 csv만 반환 (다른 ws 제외) |

#### findById
| # | 설명 |
|---|------|
| 1 | 존재하는 id → CsvFile 반환 |
| 2 | 없는 id → undefined |

#### findByRelativePath
| # | 설명 |
|---|------|
| 1 | workspaceId + relativePath 일치 → CsvFile 반환 |
| 2 | 일치 없음 → undefined |

#### create
| # | 설명 |
|---|------|
| 1 | 모든 필드 포함하여 생성 후 반환 |

#### createMany
| # | 설명 |
|---|------|
| 1 | 빈 배열 → no-op |
| 2 | 여러 건 삽입 후 findByWorkspaceId로 확인 |
| 3 | 중복 relativePath → onConflictDoNothing (에러 없음) |

#### update
| # | 설명 |
|---|------|
| 1 | 지정 필드만 변경, 나머지 보존 |
| 2 | 없는 id → undefined |

#### deleteOrphans
| # | 설명 |
|---|------|
| 1 | existingPaths에 없는 csv 삭제 |
| 2 | existingPaths 빈 배열 → 전체 삭제 |
| 3 | 모두 existingPaths에 있으면 삭제 없음 |

#### bulkDeleteByPrefix
| # | 설명 |
|---|------|
| 1 | prefix 일치하는 csv만 삭제, 나머지 보존 |

#### bulkUpdatePathPrefix
| # | 설명 |
|---|------|
| 1 | 정확히 oldPrefix와 일치하는 경로 → newPrefix로 변경 |
| 2 | oldPrefix/ 하위 경로 → newPrefix/ 하위로 변경 |
| 3 | updatedAt 갱신 확인 |

#### reindexSiblings
| # | 설명 |
|---|------|
| 1 | orderedIds 순서대로 order 재설정 |

#### delete
| # | 설명 |
|---|------|
| 1 | 삭제 후 findById → undefined |

---

### [B] csvFileService

**Mock 구조**:
```typescript
vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))
vi.mock('../../repositories/csv-file', () => ({
  csvFileRepository: {
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
vi.mock('chardet')
vi.mock('iconv-lite')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir, name) => name),
  readCsvFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))
```

#### readByWorkspaceFromDb
| # | 설명 |
|---|------|
| 1 | 정상 — repository 호출 후 CsvFileNode[] 반환 |
| 2 | 없는 workspaceId → NotFoundError |

#### create
| # | 설명 |
|---|------|
| 1 | 정상 생성 — fs.writeFileSync + repository.create 호출 |
| 2 | folderId 지정 — folderRepository.findById 호출 |
| 3 | 빈 문자열 name → 기본 이름 '새로운 테이블' 사용 |
| 4 | 없는 workspaceId → NotFoundError |
| 5 | 없는 folderId → NotFoundError |

#### rename
| # | 설명 |
|---|------|
| 1 | 정상 이름 변경 — fs.renameSync + repository.update 호출 |
| 2 | 동일 이름 (trim 후 비교) → 변경 없이 기존 객체 반환 |
| 3 | 없는 workspaceId → NotFoundError |
| 4 | 없는 csvId → NotFoundError |

#### remove
| # | 설명 |
|---|------|
| 1 | 정상 삭제 — fs.unlinkSync + repository.delete 호출 |
| 2 | 외부 삭제 (fs 에러) — repository.delete만 호출 (에러 무시) |
| 3 | 없는 workspaceId → NotFoundError |
| 4 | 없는 csvId → NotFoundError |

#### readContent
| # | 설명 |
|---|------|
| 1 | 정상 — 인코딩 감지 + iconv 디코딩 |
| 2 | 빈 파일 (length=0) → content='', encoding='UTF-8' 반환 |
| 3 | BOM 포함 파일 → BOM 제거 |
| 4 | chardet.detect → null 반환 시 UTF-8 폴백 |
| 5 | 없는 workspaceId → NotFoundError |
| 6 | 없는 csvId → NotFoundError |
| 7 | 파일 읽기 실패 (fs.readFileSync throw) → NotFoundError |

#### writeContent
| # | 설명 |
|---|------|
| 1 | 정상 — fs.writeFileSync + preview 업데이트 (첫 3줄, 200자 제한) |
| 2 | 없는 workspaceId → NotFoundError |
| 3 | 없는 csvId → NotFoundError |

#### move
| # | 설명 |
|---|------|
| 1 | 같은 폴더 이동 — fs.renameSync 미호출, reindexLeafSiblings만 호출 |
| 2 | 다른 폴더 이동 — fs.renameSync + repository.update + reindexLeafSiblings 호출 |
| 3 | 없는 workspaceId → NotFoundError |
| 4 | 없는 csvId → NotFoundError |
| 5 | 없는 targetFolderId → NotFoundError |

#### updateMeta
| # | 설명 |
|---|------|
| 1 | description 업데이트 — repository.update 호출 |
| 2 | columnWidths 업데이트 — repository.update 호출 |
| 3 | 없는 csvId → NotFoundError |

#### toCsvFileNode Date 변환
| # | 설명 |
|---|------|
| 1 | createdAt/updatedAt number → Date 인스턴스 변환 확인 |

---

## 5. 검증

```bash
npm run test          # Node 테스트 (repository + service)
```

---

## 6. 주의사항

- 서비스의 `readByWorkspace` (full fs scan + lazy upsert + 이동 감지)는 분기가 복잡하여 이번 plan에서 제외. 향후 별도 통합 테스트로 추가 가능.
- `bulkUpdatePathPrefix`, `bulkDeleteByPrefix`는 raw SQL 사용 — repository 테스트에서 직접 DB 검증.
