# Plan: tab-snapshot 테스트 코드 작성

**Feature**: tab-snapshot-tests
**Date**: 2026-02-24
**Phase**: Plan

---

## 1. 목표

tab-snapshot 기능 전체 레이어에 대한 테스트 코드 작성. 기존 프로젝트 테스트 패턴을 그대로 따른다.

---

## 2. 대상 파일 및 테스트 파일 목록

| 대상 소스                                               | 테스트 파일                                                            | 환경            |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | --------------- |
| `src/main/__tests__/setup.ts`                           | 기존 파일 수정 (tabSnapshots 정리 추가)                                | Node            |
| `src/main/repositories/tab-snapshot.ts`                 | `src/main/repositories/__tests__/tab-snapshot.test.ts`                 | Node            |
| `src/main/services/tab-snapshot.ts`                     | `src/main/services/__tests__/tab-snapshot.test.ts`                     | Node            |
| `src/renderer/src/entities/tab-snapshot/model/types.ts` | `src/renderer/src/entities/tab-snapshot/model/__tests__/types.test.ts` | Web (happy-dom) |
| `src/renderer/src/entities/tab-snapshot/api/queries.ts` | `src/renderer/src/entities/tab-snapshot/api/__tests__/queries.test.ts` | Web (happy-dom) |

---

## 3. 기존 패턴 요약

### Main Process (Node)

#### Repository 테스트 패턴

- `testDb`를 `../../__tests__/setup`에서 import해서 직접 데이터 삽입
- `beforeEach`는 setup.ts의 전역 훅으로 처리 (각 테스트 후 테이블 초기화)
- tabSnapshots는 workspaces FK 의존성 → 먼저 workspace 시드 필요
- `import { testDb } from '../../__tests__/setup'` + 스키마 테이블 import

```typescript
function seedWorkspace() {
  testDb.insert(workspaces).values(mockWorkspace).run()
}
function seedSnapshot() {
  seedWorkspace()
  return testDb.insert(tabSnapshots).values(mockSnapshot).returning().get()
}
```

#### Service 테스트 패턴

- `vi.mock('../../repositories/tab-snapshot', ...)` 로 repository 전체 mock
- `vi.mock('nanoid', ...)` 로 ID 고정
- `vi.clearAllMocks()` in `beforeEach`
- `vi.mocked(repo.method).mockReturnValue(...)` 패턴

### Renderer (Web / happy-dom)

#### Zod schema 테스트 패턴

- 순수 파싱 테스트 (no mock 필요)
- `schema.parse(data)` / `schema.safeParse(data)` 사용

#### React Query hooks 테스트 패턴

- `window.api` mock: `(window as unknown as Record<string, unknown>).api = { tabSnapshot: {...} }`
- `afterEach(() => delete (window as unknown as Record<string, unknown>).api)`
- `createWrapper()` → `QueryClientProvider` + `retry: false`
- `renderHook`, `waitFor`, `act` from `@testing-library/react`

---

## 4. 테스트 케이스 상세 계획

### 4-1. `src/main/__tests__/setup.ts` 수정

**변경 사항**: `beforeEach`에 `tabSnapshots` 테이블 정리 추가

```typescript
beforeEach(() => {
  testDb.delete(schema.tabSnapshots).run() // 추가
  testDb.delete(schema.tabSessions).run()
  testDb.delete(schema.workspaces).run()
})
```

> 이유: workspaces ON DELETE CASCADE로 인해 snapshot은 자동 삭제되지만,
> 명시적으로 처리하는 것이 더 안전하고 일관성 있음.

---

### 4-2. Repository 테스트

**파일**: `src/main/repositories/__tests__/tab-snapshot.test.ts`

#### Fixture

```typescript
const mockWorkspace = {
  id: 'ws-1',
  name: 'Test',
  path: '/test',
  createdAt: new Date(),
  updatedAt: new Date()
}
const mockSnapshot = {
  id: 'snap-1',
  name: 'My Snapshot',
  description: null,
  workspaceId: 'ws-1',
  tabsJson: '{"tab-1":{}}',
  panesJson: '{"pane-1":{}}',
  layoutJson: '{"type":"pane"}',
  createdAt: new Date(),
  updatedAt: new Date()
}
```

#### `findByWorkspaceId`

- [ ] 빈 배열을 반환한다 (데이터 없음)
- [ ] 해당 workspaceId의 스냅샷만 반환한다
- [ ] 다른 workspaceId의 스냅샷은 포함하지 않는다

#### `findById`

- [ ] 존재하는 id면 스냅샷을 반환한다
- [ ] 존재하지 않는 id면 undefined를 반환한다

#### `create`

- [ ] 스냅샷을 생성하고 반환한다

#### `update`

- [ ] name과 description을 수정한다
- [ ] tabsJson, panesJson, layoutJson을 수정한다 (overwrite 기능)
- [ ] 존재하지 않는 id면 undefined를 반환한다

#### `delete`

- [ ] 스냅샷을 삭제한다 (삭제 후 findById → undefined)

---

### 4-3. Service 테스트

**파일**: `src/main/services/__tests__/tab-snapshot.test.ts`

#### Mocks

```typescript
vi.mock('../../repositories/tab-snapshot', () => ({
  tabSnapshotRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('nanoid', () => ({ nanoid: () => 'mocked-id' }))
```

#### `getByWorkspaceId`

- [ ] repository.findByWorkspaceId 결과를 반환한다

#### `create`

- [ ] 유효한 입력으로 스냅샷을 생성한다
- [ ] nanoid로 생성된 id가 repository.create에 전달된다
- [ ] name이 trim()되어 저장된다
- [ ] description이 없으면 null로 저장된다
- [ ] 빈 name이면 ValidationError를 던진다
- [ ] 공백만 있는 name이면 ValidationError를 던진다
- [ ] tabsJson이 없으면 ValidationError를 던진다
- [ ] panesJson이 없으면 ValidationError를 던진다
- [ ] layoutJson이 없으면 ValidationError를 던진다

#### `update`

- [ ] 존재하는 스냅샷을 수정한다
- [ ] updatedAt이 새로운 값으로 업데이트된다
- [ ] 존재하지 않는 id면 NotFoundError를 던진다
- [ ] name이 명시적으로 전달되었는데 빈 문자열이면 ValidationError를 던진다
- [ ] name이 undefined면 name 검증을 건너뛴다 (JSON만 업데이트)

#### `delete`

- [ ] 존재하는 스냅샷을 삭제한다 (repository.delete 호출 확인)
- [ ] 존재하지 않는 id면 NotFoundError를 던진다

---

### 4-4. Zod Schema 테스트

**파일**: `src/renderer/src/entities/tab-snapshot/model/__tests__/types.test.ts`

#### `TabSnapshotSchema`

- [ ] 유효한 데이터를 파싱한다
- [ ] name이 빈 문자열이면 파싱 실패한다 (min(1) 오류)
- [ ] description이 null이어도 파싱 성공한다
- [ ] createdAt이 숫자(timestamp)면 Date로 변환된다
- [ ] updatedAt이 문자열 날짜면 Date로 변환된다
- [ ] createdAt/updatedAt이 Date 타입으로 반환된다

---

### 4-5. React Query Hooks 테스트

**파일**: `src/renderer/src/entities/tab-snapshot/api/__tests__/queries.test.ts`

#### Fixture & Setup

```typescript
const mockApi = {
  tabSnapshot: {
    getByWorkspaceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}
beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = mockApi
  vi.clearAllMocks()
})
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})
```

#### `useTabSnapshots`

- [ ] 스냅샷 목록을 반환한다
- [ ] workspaceId가 빈 문자열이면 쿼리가 실행되지 않는다 (enabled: false)
- [ ] IPC 실패 시 에러 상태가 된다

#### `useCreateTabSnapshot`

- [ ] 스냅샷을 생성하고 해당 workspaceId 캐시를 무효화한다
- [ ] IPC 실패 시 에러 상태가 된다

#### `useUpdateTabSnapshot`

- [ ] 스냅샷을 수정하고 해당 workspaceId 캐시를 무효화한다
- [ ] tabsJson/panesJson/layoutJson 포함 업데이트 payload 전달 확인 (overwrite 기능)
- [ ] IPC 실패 시 에러 상태가 된다

#### `useDeleteTabSnapshot`

- [ ] 스냅샷을 삭제하고 전체 tabSnapshots 캐시를 무효화한다
- [ ] IPC 실패 시 에러 상태가 된다

---

## 5. 구현 순서

1. `src/main/__tests__/setup.ts` 수정 (tabSnapshots 정리 추가)
2. `src/main/repositories/__tests__/tab-snapshot.test.ts` 작성
3. `src/main/services/__tests__/tab-snapshot.test.ts` 작성
4. `src/renderer/src/entities/tab-snapshot/model/__tests__/types.test.ts` 작성
5. `src/renderer/src/entities/tab-snapshot/api/__tests__/queries.test.ts` 작성
6. `npm run test` 및 `npm run test:web` 실행하여 전체 통과 확인

---

## 6. 검증 기준

- [ ] `npm run test` 전체 통과
- [ ] `npm run test:web` 전체 통과
- [ ] 신규 테스트 파일 4개 + 기존 setup.ts 수정 1개
- [ ] 총 테스트 케이스: repository(8) + service(11) + schema(6) + hooks(8) = **33개 이상**
