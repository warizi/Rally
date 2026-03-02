# Plan: Link 테스트 코드 작성

> 작성일: 2026-03-02
> 기능: link-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

Link(entity-link) 기능은 이미 구현 완료되어 있으나 테스트 코드가 없는 상태이다.
범용 엔티티 링크 시스템의 핵심 로직(정규화, 검증, 양방향 조회, 고아 링크 정리)을
테스트로 검증하여 신뢰성을 확보한다.

또한, link 기능 통합 과정에서 기존 `todoService.remove()`에 `findAllDescendantIds` +
`entityLinkService.removeAllLinksForTodos` 호출이 추가되었으나, 기존 `todo.test.ts`의
mock에 `findAllDescendantIds`가 누락되어 **remove 테스트가 깨진 상태**이다.
이를 함께 수정한다.

---

## 2. 테스트 파일 목록

### 2-1. Main Process — `vitest.config.node.mts` (`npm run test`)

| 파일 | 비고 |
|------|------|
| `src/main/repositories/__tests__/entity-link.test.ts` | **신규** — testDb (in-memory SQLite) 사용 |
| `src/main/repositories/__tests__/todo.test.ts` | **신규/수정** — findAllDescendantIds BFS 통합 테스트 |
| `src/main/services/__tests__/entity-link.test.ts` | **신규** — repository 전체 vi.mock |
| `src/main/services/__tests__/todo.test.ts` | **수정** — findAllDescendantIds mock 추가 + entityLinkService mock 추가 |

> ⚠️ Node 환경은 `globals: false` → `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import

### 2-2. Renderer — `vitest.config.web.mts` (`npm run test:web`)

| 파일 | 비고 |
|------|------|
| `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts` | **신규** — 순수 함수 |

---

## 3. 환경 설정

### `src/main/__tests__/setup.ts` — **수정 불필요**

현재 setup.ts의 `beforeEach`에서 `entity_links` 테이블이 명시적으로 초기화되지 않고 있다.
하지만 `entity_links.workspaceId`는 `workspaces.id` FK cascade 이므로
workspaces 삭제 시 entity_links가 자동 cascade 삭제된다. 수정 불필요.

---

## 4. 기존 테스트 수정

### [D] todo.test.ts 수정

**파일**: `src/main/services/__tests__/todo.test.ts`

**문제**: link 기능 통합으로 `todoService.remove()`가 아래를 호출하게 되었으나
기존 mock이 업데이트되지 않음:

```typescript
// todo.ts:201-208 현재 구현
remove(todoId: string): void {
  const todo = todoRepository.findById(todoId)
  if (!todo) throw new NotFoundError(...)
  const subtodoIds = todoRepository.findAllDescendantIds(todoId)    // ← mock 누락
  entityLinkService.removeAllLinksForTodos([todoId, ...subtodoIds]) // ← mock 누락
  todoRepository.delete(todoId)
}
```

**수정 1 — todoRepository mock에 `findAllDescendantIds` 추가**:

```typescript
vi.mock('../../repositories/todo', () => ({
  todoRepository: {
    // ... 기존 메서드들 ...
    findAllDescendantIds: vi.fn(),  // ← 추가
  }
}))
```

**수정 2 — entityLinkService mock 추가**:

```typescript
vi.mock('../entity-link', () => ({
  entityLinkService: {
    removeAllLinksForTodos: vi.fn(),
  }
}))
```

**수정 3 — beforeEach에 기본 반환값 설정**:

```typescript
vi.mocked(todoRepository.findAllDescendantIds).mockReturnValue([])
```

**수정 4 — remove 테스트 보강**:

| # | 테스트명 | 검증 |
|---|---------|------|
| 기존1 | 정상 삭제 → todoRepository.delete 1회 | 기존과 동일 (mock 수정으로 통과) |
| 기존2 | 없는 todoId → NotFoundError | 기존과 동일 |
| 추가1 | 삭제 시 findAllDescendantIds 호출 | findAllDescendantIds(todoId) 호출 확인 |
| 추가2 | 삭제 시 entityLinkService.removeAllLinksForTodos 호출 | [todoId, ...subtodoIds] 인자 확인 |
| 추가3 | subtodo 있을 때 → 본인+subtodo ID 모두 전달 | findAllDescendantIds가 ['sub-1','sub-2'] 반환 시 removeAllLinksForTodos(['todo-1','sub-1','sub-2']) |

### [D-2] findAllDescendantIds BFS 통합 테스트 (todoRepository)

**파일**: `src/main/repositories/__tests__/todo.test.ts` (신규 또는 기존 todo repository 테스트에 추가)

**배경**: `findAllDescendantIds`는 BFS 알고리즘으로 하위 todo ID를 재귀 탐색하는 메서드이나
통합 테스트가 아직 없다. `todoService.remove()`에서 핵심적으로 사용되므로 검증 필요.

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | 자식 없는 todo → 빈 배열 | findAllDescendantIds('leaf') → [] |
| 2 | 1단계 자식 → 자식 ID 배열 | parent → [child-1, child-2] |
| 3 | 다단계 (parent→child→grandchild) → 모든 하위 ID | parent → [child, grandchild] |
| 4 | 존재하지 않는 parentId → 빈 배열 | findAllDescendantIds('non-exist') → [] |

> **근거**: BFS 구현(todo.ts:119-137)은 queue 기반이며, 다단계 구조에서
> 모든 depth의 하위 ID를 수집해야 한다. 특히 3단계 이상 중첩 시 빠짐없이 반환하는지 확인.
> in-memory SQLite + testDb로 실행 가능.

---

## 5. 테스트 케이스 상세

---

### [A] entityLinkRepository

**파일**: `src/main/repositories/__tests__/entity-link.test.ts`

**픽스처 헬퍼 패턴**:
```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { entityLinkRepository, type EntityLinkInsert } from '../entity-link'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb.insert(schema.workspaces).values({
    id: WS_ID, name: 'Test', path: '/test',
    createdAt: new Date(), updatedAt: new Date()
  }).run()
})

function makeLink(overrides?: Partial<EntityLinkInsert>): EntityLinkInsert {
  return {
    sourceType: 'note',
    sourceId: 'note-1',
    targetType: 'todo',
    targetId: 'todo-1',
    workspaceId: WS_ID,
    createdAt: new Date(),
    ...overrides
  }
}
```

#### A-1. link

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | 링크 생성 → findByEntity로 조회 가능 | link 후 findByEntity 결과 length=1 |
| 2 | 중복 링크 시도 → 에러 없이 무시 (onConflictDoNothing) | 같은 데이터 2회 link, findByEntity length=1 |
| 3 | 다른 엔티티 쌍 → 각각 생성 | 2개 link, findByEntity 각각 확인 |

#### A-2. unlink

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | 존재하는 링크 삭제 → findByEntity 빈 배열 | link → unlink → findByEntity length=0 |
| 2 | 존재하지 않는 링크 삭제 → 에러 없음 | unlink 호출 시 throw 없음 |

#### A-3. findByEntity

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | source 방향으로 매칭 | sourceType+sourceId로 조회 가능 |
| 2 | target 방향으로 매칭 (양방향 조회) | targetType+targetId로 조회 가능 |
| 3 | 무관한 엔티티 → 빈 배열 | 관련 없는 type/id → length=0 |
| 4 | 여러 링크가 있는 엔티티 → 모두 반환 | 3개 링크 생성 → length=3 |
| 5 | createdAt이 Date 인스턴스로 반환 | `result[0].createdAt instanceof Date` |

#### A-4. removeAllByEntity

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | source로 참여한 링크 모두 삭제 | link 2개 → removeAllByEntity → 모두 삭제 |
| 2 | target으로 참여한 링크도 삭제 | target 방향 링크도 함께 삭제 |
| 3 | 무관한 링크는 유지 | 다른 엔티티의 링크는 영향 없음 |

#### A-5. removeAllByEntities

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | 여러 ID의 링크 일괄 삭제 | 3개 todo ID 링크 → removeAllByEntities → 모두 삭제 |
| 2 | 빈 배열 → no-op | 빈 배열 전달 시 기존 링크 유지 |

---

### [B] entityLinkService

**파일**: `src/main/services/__tests__/entity-link.test.ts`

**Mock 패턴**: 기존 todoService 테스트와 동일하게 repository들을 vi.mock

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { entityLinkService } from '../entity-link'
import { entityLinkRepository } from '../../repositories/entity-link'
import { todoRepository } from '../../repositories/todo'
import { scheduleRepository } from '../../repositories/schedule'
import { noteRepository } from '../../repositories/note'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { csvFileRepository } from '../../repositories/csv-file'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/entity-link', () => ({
  entityLinkRepository: {
    link: vi.fn(),
    unlink: vi.fn(),
    findByEntity: vi.fn(),
    removeAllByEntity: vi.fn(),
    removeAllByEntities: vi.fn()
  }
}))

vi.mock('../../repositories/todo', () => ({ todoRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/schedule', () => ({ scheduleRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/note', () => ({ noteRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/pdf-file', () => ({ pdfFileRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/csv-file', () => ({ csvFileRepository: { findById: vi.fn() } }))
```

**Mock 헬퍼**: 엔티티 존재 시뮬레이션용

```typescript
const MOCK_ENTITY = { workspaceId: 'ws-1', title: 'Test Entity' }

function mockFindById(type: LinkableEntityType, returnValue: any = MOCK_ENTITY) {
  switch (type) {
    case 'todo': vi.mocked(todoRepository.findById).mockReturnValue(returnValue); break
    case 'schedule': vi.mocked(scheduleRepository.findById).mockReturnValue(returnValue); break
    case 'note': vi.mocked(noteRepository.findById).mockReturnValue(returnValue); break
    case 'pdf': vi.mocked(pdfFileRepository.findById).mockReturnValue(returnValue); break
    case 'csv': vi.mocked(csvFileRepository.findById).mockReturnValue(returnValue); break
  }
}
```

#### B-1. link

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | 정상 링크 — entityLinkRepository.link 호출 | 양쪽 findById 반환, repository.link 1회 호출 |
| 2 | 정규화: todo+note → source=note, target=todo | repository.link 호출 인자의 sourceType='note', targetType='todo' |
| 3 | 정규화 Branch 3: 같은 타입, idA < idB → source=idA | `('todo','a-id','todo','b-id')` → sourceId='a-id', targetId='b-id' |
| 3-R | 정규화 Branch 4: 같은 타입, idA > idB → 역전 | `('todo','b-id','todo','a-id')` → sourceId='a-id', targetId='b-id' (3과 동일 결과) |
| 4 | EC-01: 자기 자신 링크 → ValidationError (findById 호출 안 됨) | `('todo','id-1','todo','id-1')` → throw, findById 0회 호출 확인 |
| 5 | EC-02: typeA 엔티티 미존재 → NotFoundError | typeA findById → undefined |
| 6 | EC-02: typeB 엔티티 미존재 → NotFoundError | typeB findById → undefined (typeA는 존재) |
| 7 | EC-03: 다른 워크스페이스 → ValidationError | entityA.workspaceId='ws-1', entityB.workspaceId='ws-2' |
| 8 | EC-03: 전달된 workspaceId 불일치 → ValidationError | 양쪽 wsId='ws-1'이지만 인자 workspaceId='ws-other' |
| 9 | createdAt 필드 포함 (Date 인스턴스) | repository.link 호출 인자에 createdAt: expect.any(Date) |
| 10 | entityA의 workspaceId가 null → ValidationError (L81) | typeA='schedule', findById → `{ workspaceId: null, title: 'T' }` → getWorkspaceId(typeA)에서 throw |
| 11 | entityB만 workspaceId null → ValidationError (L82) | typeA='todo'(정상), typeB='schedule'(null) → getWorkspaceId(typeB)에서 throw, typeA findById는 정상 호출됨 |

> **B-1-10~11 근거**: `schedules.workspaceId`는 `.notNull()` 없이 정의되어 nullable.
> `getWorkspaceId()` (entity-link.ts:35-38)에서 null 체크 후 `ValidationError` 발생.
> L81(entityA)과 L82(entityB) 각각에서 null이 발생하는 시나리오를 분리하여 검증.

#### B-2. unlink

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | 정상 언링크 — 정규화 후 repository.unlink 호출 | sourceType/targetType 정규화 순서 확인 |
| 2 | 역순 인자 전달해도 동일 정규화 | `(todo,id,note,id)` 와 `(note,id,todo,id)` 호출 시 repository.unlink 인자 동일 |

#### B-3. getLinked

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | source 방향 링크 → linkedType/linkedId 정확 추출 | row.sourceType === entityType일 때 target 쪽 반환 |
| 2 | target 방향 링크 → linkedType/linkedId 정확 추출 | row.targetType === entityType일 때 source 쪽 반환 |
| 3 | 엔티티 제목 포함 | result.title === entity.title |
| 4 | EC-09: 삭제된 엔티티 → 결과에서 필터링 + orphan unlink | findById → undefined → result에 미포함 + unlink 호출 |
| 5 | 혼합: 유효 2건 + 고아 1건 → result 2건 + unlink 1회 | findByEntity 3 row 반환, 그중 1건 findById=undefined → result.length=2, unlink 1회 |
| 6 | 빈 결과 → 빈 배열 반환 | findByEntity → [] → result=[] |
| 7 | linkedAt 필드 포함 | result[0].linkedAt === row.createdAt |
| 8 | 같은 타입 링크(todo↔todo) — isSource 분기 | `findByEntity('todo','t-1')` → row `{sourceType:'todo',sourceId:'t-1',targetType:'todo',targetId:'t-2'}` → isSource=true → linkedId='t-2' |
| 9 | 같은 타입 링크 — isSource=false 방향 | `findByEntity('todo','t-2')` 시 같은 row → isSource=false → linkedId='t-1' |
| 10 | 전부 고아인 경우 → 빈 배열 + orphan 전체 unlink | findByEntity 2 row 반환, 모두 findById=undefined → result=[], unlink 2회 |

> **B-3-5 근거**: 실무에서 가장 빈도 높은 시나리오. 하나의 엔티티가 삭제되고 나머지는 남아있는 경우.
> 유효 건은 정상 반환되고, 고아 건만 정리되는지 한 테스트에서 통합 검증.
>
> **B-3-8~9 근거**: `isSource` 판별 (entity-link.ts:119)은 `row.sourceType === entityType && row.sourceId === entityId`.
> 같은 타입 링크(todo↔todo)에서는 sourceType과 targetType이 모두 'todo'이므로
> **sourceId만으로 방향이 결정**된다. 양방향 조회를 각각 검증해야 정확성 확보.
>
> **B-3-10 근거**: 모든 연결된 엔티티가 삭제된 극단 시나리오. orphan loop가 전체 row를 unlink하고
> 빈 배열을 반환하는지 검증.

#### B-4. removeAllLinks

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | repository.removeAllByEntity 위임 호출 | 인자 전달 확인 |

#### B-5. removeAllLinksForTodos

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | repository.removeAllByEntities('todo', ids) 위임 호출 | 인자 전달 확인 |

---

### [C] toTabOptions (renderer 순수 함수)

**파일**: `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts`

| # | 테스트명 | 검증 |
|---|---------|------|
| 1 | todo → type='todo-detail', pathname='/todo/{id}', title=전달값 | 반환값 정확성 |
| 2 | note → type='note', pathname='/folder/note/{id}', title=전달값 | 반환값 정확성 |
| 3 | pdf → type='pdf', pathname='/folder/pdf/{id}', title=전달값 | 반환값 정확성 |
| 4 | csv → type='csv', pathname='/folder/csv/{id}', title=전달값 | 반환값 정확성 |
| 5 | schedule → type='calendar', pathname='/calendar', 전달 title 무시 → 고정 '캘린더' | `toTabOptions('schedule','s1','내 일정')` → title='캘린더' |

> **C-5 근거**: schedule case는 인자로 받은 title을 무시하고 하드코딩된 '캘린더'를 반환.
> 명시적으로 다른 title을 전달하여 무시되는 것을 검증.

---

## 6. 구현 순서

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `src/main/services/__tests__/todo.test.ts` | **수정** — findAllDescendantIds + entityLinkService mock 추가 |
| 2 | `src/main/repositories/__tests__/todo.test.ts` | **신규/수정** — findAllDescendantIds BFS 통합 테스트 |
| 3 | `src/main/repositories/__tests__/entity-link.test.ts` | **신규** — Repository 통합 테스트 (in-memory SQLite) |
| 4 | `src/main/services/__tests__/entity-link.test.ts` | **신규** — Service 단위 테스트 (vi.mock) |
| 5 | `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts` | **신규** — Renderer 순수 함수 테스트 |
| 6 | 테스트 실행 및 전체 통과 확인 | `npm run test && npm run test:web` |

> **순서 근거**: todo.test.ts를 먼저 수정하여 기존 테스트 깨짐을 해소한 후,
> findAllDescendantIds BFS 통합 테스트 → entity-link 테스트 → renderer 순수 함수 순서로 추가한다.

---

## 7. 테스트하지 않는 항목

| 항목 | 이유 |
|------|------|
| IPC 핸들러 (`ipc/entity-link.ts`) | handle() 래퍼만 호출하는 얇은 레이어. service 테스트로 커버 |
| React Query hooks (`entities/entity-link/model/queries.ts`) | window.api mock 필요. service 레이어에서 로직 검증 완료 |
| UI 컴포넌트 (LinkedEntityList, LinkEntityPopover 등) | 복잡한 render 환경 필요. 수동 QA로 대체 |
| Preload bridge | 단순 ipcRenderer.invoke 위임 |
| note/csv/pdf service의 remove 내 entityLinkService 호출 | 이 서비스들은 repository를 mock하지 않는 hybrid 패턴이라, entityLinkService가 실제 entityLinkRepository → testDb로 체인 실행되어 **정상 동작**함. mock 추가 불필요 |

> **주의**: todo.test.ts만 유일하게 todoRepository를 factory mock하며,
> `findAllDescendantIds`가 mock에서 누락되어 깨진 상태. → **섹션 4에서 수정**.
> csv/pdf/note 서비스 테스트는 실제 repository + testDb hybrid 패턴이라 영향 없음.

---

## 8. 성공 기준

- `npm run test` — entity-link repository/service 테스트 + 수정된 todo 테스트 전체 통과
- `npm run test:web` — toTabOptions 테스트 전체 통과
- 기존 테스트 깨짐 없음 (todo.test.ts 수정으로 해소)
