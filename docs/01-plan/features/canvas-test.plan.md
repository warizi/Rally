# Plan: Canvas 테스트 코드 작성

> 작성일: 2026-03-03
> 기능: canvas-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

Canvas 기능(캔버스, 노드, 엣지)은 구현 완료되어 있으나, 테스트 코드가
순수 함수(converters, canvas-layout) 2개 파일에만 존재한다.
Repository → Service → Renderer Queries 계층의 테스트를 추가하여 신뢰성을 확보한다.

### 이미 테스트됨 (작성 불필요)

| 파일 | 비고 |
| ---- | ---- |
| `src/renderer/src/entities/canvas/model/__tests__/converters.test.ts` | 순수 함수 ~20건 |
| `src/renderer/src/widgets/canvas/model/__tests__/canvas-layout.test.ts` | 순수 함수 ~6건 |

---

## 2. 테스트 파일 목록

### 2-1. Main Process — `vitest.config.node.mts` (`npm run test`)

| 파일 | 비고 |
| ---- | ---- |
| `src/main/repositories/__tests__/canvas.test.ts` | testDb (in-memory SQLite) 사용 |
| `src/main/repositories/__tests__/canvas-node.test.ts` | testDb + canvas FK 의존 |
| `src/main/repositories/__tests__/canvas-edge.test.ts` | testDb + canvas + node FK 의존 |
| `src/main/services/__tests__/canvas.test.ts` | repository 전체 vi.mock |
| `src/main/services/__tests__/canvas-node.test.ts` | repository 전체 vi.mock |
| `src/main/services/__tests__/canvas-edge.test.ts` | repository 전체 vi.mock |

> ⚠️ Node 환경은 `globals: false` → `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import

### 2-2. Renderer — `vitest.config.web.mts` (`npm run test:web`)

| 파일 | 비고 |
| ---- | ---- |
| `src/renderer/src/entities/canvas/model/__tests__/queries.test.ts` | renderHook + QueryClientProvider + waitFor |

---

## 3. 환경 설정

### `src/main/__tests__/setup.ts` — **수정 불필요**

`canvases.workspaceId → workspaces.id (onDelete: cascade)` 이므로 workspaces 삭제 시
canvases → canvas_nodes → canvas_edges 전체가 자동 cascade 삭제된다.

---

## 4. 테스트 케이스 상세

---

### [A] canvasRepository

**픽스처 헬퍼 패턴**:

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { canvasRepository, type CanvasInsert } from '../canvas'

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

function makeCanvas(overrides?: Partial<CanvasInsert>): CanvasInsert {
  return {
    id: 'canvas-1',
    workspaceId: WS_ID,
    title: 'Test Canvas',
    description: '',
    viewportX: 0,
    viewportY: 0,
    viewportZoom: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
```

#### `findByWorkspaceId`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 캔버스 없음 | `[]` |
| 2 | 캔버스 여러 개 | 전체 반환 |
| 3 | 다른 워크스페이스 캔버스 배제 | 해당 workspaceId만 반환 |

#### `findById`

- 존재하는 id → Canvas 반환
- 없는 id → `undefined`

#### `create`

- 모든 필드 반환값 검증 (id, title, description, viewportX/Y/Zoom, createdAt, updatedAt)
- viewport 기본값: `viewportX=0, viewportY=0, viewportZoom=1`

#### `update`

- 지정 필드만 변경 (title만), 나머지 보존
- 없는 id → `undefined` 반환

#### `updateViewport`

- viewportX/Y/Zoom 변경, title 등 기타 필드 불변 확인
- `returning()` 없음 (void) → `findById`로 결과 검증

#### `delete`

- 삭제 후 `findById` → `undefined`
- cascade: canvas 삭제 시 소속 node도 삭제됨

---

### [B] canvasNodeRepository

**픽스처 의존**: workspace → canvas 순서로 insert 필요

```typescript
const WS_ID = 'ws-1'
const CANVAS_ID = 'canvas-1'

beforeEach(() => {
  testDb.insert(schema.workspaces).values({ ... }).run()
  testDb.insert(schema.canvases).values({
    id: CANVAS_ID,
    workspaceId: WS_ID,
    title: 'Test Canvas',
    description: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }).run()
})

function makeNode(overrides?: Partial<CanvasNodeInsert>): CanvasNodeInsert {
  return {
    id: 'node-1',
    canvasId: CANVAS_ID,
    type: 'text',
    refId: null,
    x: 100,
    y: 200,
    width: 260,
    height: 160,
    color: null,
    content: 'hello',
    zIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
```

#### `findByCanvasId`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 노드 없음 | `[]` |
| 2 | 노드 여러 개 | 전체 반환 |

#### `findById`

- 존재하는 id → CanvasNode 반환
- 없는 id → `undefined`

#### `findByIds`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 빈 배열 | `[]` |
| 2 | 정상 (2개 ID) | 해당 2개 반환 |

> chunking(900) 테스트는 실질적으로 불필요 (메모리 DB에 900개 insert 비효율적)

#### `create`

- 모든 필드 반환값 검증 (id, type, refId, x, y, width, height, color, content, zIndex)

#### `update`

- 부분 업데이트 (content만 변경) → 나머지 보존
- 없는 id → `undefined` 반환

#### `bulkUpdatePositions`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 빈 배열 → no-op | DB 변화 없음 |
| 2 | 여러 노드 position 변경 | x, y 갱신 + `updatedAt` 갱신 |

> `bulkUpdatePositions`는 raw SQL로 `Date.now()` (integer) 저장.
> Drizzle ORM이 `mode: 'timestamp_ms'`로 읽어올 때 `Date` 인스턴스로 변환됨.
> 검증: `findById` 후 `updatedAt`이 `beforeEach` 시점 이후인지 비교

#### `delete`

- 삭제 후 `findById` → `undefined`
- FK cascade: 노드 삭제 시 연결된 edge도 삭제됨

#### `deleteByRef`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 해당 type + refId 노드 삭제 | 대상 노드만 삭제 |
| 2 | 같은 refId지만 다른 type | 삭제 안 됨 |

---

### [C] canvasEdgeRepository

**픽스처 의존**: workspace → canvas → node × 2 순서로 insert 필요

```typescript
const NODE_A = 'node-a'
const NODE_B = 'node-b'

beforeEach(() => {
  // workspace, canvas, node-a, node-b 순서 insert
})

function makeEdge(overrides?: Partial<CanvasEdgeInsert>): CanvasEdgeInsert {
  return {
    id: 'edge-1',
    canvasId: CANVAS_ID,
    fromNode: NODE_A,
    toNode: NODE_B,
    fromSide: 'right',
    toSide: 'left',
    label: null,
    color: null,
    style: 'solid',
    arrow: 'end',
    createdAt: new Date(),
    ...overrides
  }
}
```

#### `findByCanvasId`

- 빈 결과 / 여러 엣지 반환

#### `findById`

- 존재 → CanvasEdge 반환
- 미존재 → `undefined`

#### `create`

- 모든 필드 반환값 검증
- defaults: `fromSide='right'`, `toSide='left'`, `style='solid'`, `arrow='end'`

#### `update`

- 부분 업데이트 (style만 변경) → 나머지 보존
- 없는 id → `undefined`

#### `delete`

- 삭제 후 `findById` → `undefined`

---

### [D] canvasService

**Mock 선언** (파일: `src/main/services/__tests__/canvas.test.ts`):

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canvasService } from '../canvas'
import { canvasRepository } from '../../repositories/canvas'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas', () => ({
  canvasRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateViewport: vi.fn(),
    delete: vi.fn()
  }
}))
```

**Mock 반환값 주의**:

`canvasService`는 내부적으로 `toCanvasItem(row)`를 호출하므로,
repository mock 반환값은 **완전한 Canvas 객체**여야 한다.

```typescript
const MOCK_CANVAS_ROW = {
  id: 'canvas-1',
  workspaceId: 'ws-1',
  title: 'Test',
  description: '',
  viewportX: 0,
  viewportY: 0,
  viewportZoom: 1,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

**기본 beforeEach**:

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue({
    id: 'ws-1',
    name: 'Test',
    path: '/test',
    createdAt: new Date(),
    updatedAt: new Date()
  })
})
```

#### `findByWorkspace`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 정상 | `CanvasItem[]` 반환, Date 타입 확인 |
| 2 | workspace 없음 | `NotFoundError` |

#### `findById`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 정상 | `CanvasItem` 반환, `createdAt`/`updatedAt`이 Date 인스턴스 |
| 2 | canvas 없음 | `NotFoundError` |

#### `create`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | 정상 생성 | `canvasRepository.create` 호출, nanoid ID, timestamps = Date |
| 2 | `title='  제목  '` 전달 | `title: '제목'` (trim 적용) |
| 3 | `description` 미전달 | `description: ''` 전달 |
| 4 | `description='  설명  '` 전달 | `description: '설명'` (trim 적용) |
| 5 | workspace 없음 | `NotFoundError` |

#### `update`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | title만 변경 | `title.trim()` 적용, `updatedAt` 설정 |
| 2 | description만 변경 | `description.trim()` 적용 |
| 3 | canvas findById 없음 | `NotFoundError` |
| 4 | canvas update 반환 undefined | `NotFoundError` |

#### `updateViewport`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | 정상 | `x/y/zoom → viewportX/viewportY/viewportZoom` 매핑 확인 |
| 2 | 정상 | `updatedAt`이 repository 호출 인자에 **미포함** (viewport만 변경) |
| 3 | canvas 없음 | `NotFoundError` |

#### `remove`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | 정상 | `canvasRepository.delete` 호출 |
| 2 | canvas 없음 | `NotFoundError` |

---

### [E] canvasNodeService

**Mock 선언** (파일: `src/main/services/__tests__/canvas-node.test.ts`):

```typescript
vi.mock('../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: {
    findByCanvasId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    bulkUpdatePositions: vi.fn(),
    delete: vi.fn()
  }
}))

// batchFetchRefs가 사용하는 6개 repository
vi.mock('../../repositories/todo', () => ({
  todoRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/note', () => ({
  noteRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/schedule', () => ({
  scheduleRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/csv-file', () => ({
  csvFileRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/pdf-file', () => ({
  pdfFileRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/image-file', () => ({
  imageFileRepository: { findByIds: vi.fn() }
}))
```

**Mock 반환값**:

```typescript
const MOCK_NODE_ROW = {
  id: 'node-1',
  canvasId: 'canvas-1',
  type: 'text',
  refId: null,
  x: 100,
  y: 200,
  width: 260,
  height: 160,
  color: null,
  content: 'hello',
  zIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

#### `findByCanvas`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | canvas 없음 | `NotFoundError` |
| 2 | 노드 없음 (빈 배열) | `[]` |
| 3 | text 노드만 | refTitle/refPreview/refMeta 전부 `undefined` |
| 4 | todo ref 노드 | `refTitle`, `refPreview`, `refMeta.isDone/status/priority` 존재 |
| 5 | note ref 노드 | `refTitle`, `refPreview` (preview 200자 제한) |
| 6 | schedule ref 노드 | `refMeta.allDay/startAt/endAt/color/priority` 존재 |
| 7 | csv ref 노드 | `refTitle=c.title`, `refPreview=c.preview ?? ''` |
| 8 | pdf ref 노드 | `refTitle=p.title`, `refPreview=p.preview ?? ''` |
| 9 | image ref 노드 | `refTitle=img.title`, `refPreview=img.description ?? ''` ← **description** 사용 (preview 아님) |
| 10 | refId 없는 ref 타입 | `batchFetchRefs`에서 skip됨, ref 필드 `undefined` |

> `batchFetchRefs` 테스트가 핵심 — type별 repository 호출 여부 + refMap 매핑

#### `create`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | canvas 없음 | `NotFoundError` |
| 2 | 정상 (text) | nanoid ID, defaults: width=260, height=160, zIndex=0, refId=null, color=null, content=null |
| 3 | 정상 (ref) | `refId` 전달됨 |
| 4 | custom width/height | 전달값 사용 (260/160 아닌 값) |

#### `update`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | node 없음 (findById) | `NotFoundError` |
| 2 | node 없음 (update 반환 undefined) | `NotFoundError` |
| 3 | content만 변경 | `content` 필드만 포함, `updatedAt` 설정 |
| 4 | width + height 변경 | 부분 업데이트 확인 |

#### `fetchRefData`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | 정상 (ref 노드 있음) | `Map<string, RefData>` 반환 |
| 2 | 노드 없음 | 빈 `Map` 반환 (**NotFoundError 아님** — canvas 존재 확인 없음) |

> `findByCanvas`와 달리 `fetchRefData`는 canvas 존재 확인을 하지 않음.
> `canvasNodeRepository.findByCanvasId`를 직접 호출하여 빈 배열이면 빈 Map 반환.

#### `updatePositions`

- `canvasNodeRepository.bulkUpdatePositions` 직접 위임 확인 (검증 없음)

#### `remove`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | node 없음 | `NotFoundError` |
| 2 | 정상 | `canvasNodeRepository.delete` 호출 |

---

### [F] canvasEdgeService

**Mock 선언** (파일: `src/main/services/__tests__/canvas-edge.test.ts`):

```typescript
vi.mock('../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-edge', () => ({
  canvasEdgeRepository: {
    findByCanvasId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))
```

**Mock 반환값**:

```typescript
const MOCK_EDGE_ROW = {
  id: 'edge-1',
  canvasId: 'canvas-1',
  fromNode: 'node-a',
  toNode: 'node-b',
  fromSide: 'right',
  toSide: 'left',
  label: null,
  color: null,
  style: 'solid',
  arrow: 'end',
  createdAt: new Date()
}
```

#### `findByCanvas`

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | canvas 없음 | `NotFoundError` |
| 2 | 정상 | `CanvasEdgeItem[]` 반환, `createdAt`이 Date 인스턴스 |

#### `create` — 가장 풍부한 검증 대상

| # | 케이스 | 기대값 |
| - | ------ | ------ |
| 1 | canvas 없음 | `NotFoundError` |
| 2 | `fromNode === toNode` (self-loop) | `ValidationError('Cannot create self-loop edge')` |
| 3 | fromNode 없음 | `NotFoundError('From node not found: ...')` |
| 4 | toNode 없음 | `NotFoundError('To node not found: ...')` |
| 5 | 중복 엣지 (같은 fromNode+toNode 방향) | `ValidationError('Duplicate edge already exists')` |
| 6 | 역방향 엣지 (A→B 존재 시 B→A 생성) | **정상 생성** (중복 아님 — 방향성 체크) |
| 7 | 정상 + 기본값 | defaults: `fromSide='right'`, `toSide='left'`, `style='solid'`, `arrow='end'`, `label=null`, `color=null` |
| 8 | 정상 + 커스텀 값 | `fromSide='top'`, `toSide='bottom'`, `style='dashed'`, `arrow='both'` 전달 |

> **검증 순서가 중요**: canvas → self-loop → fromNode → toNode → duplicate → create
> **중복 체크는 방향성(directional)**: `e.fromNode === data.fromNode && e.toNode === data.toNode`
> A→B가 있어도 B→A는 중복이 아님 (허용)

#### `update`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | edge 없음 (findById) | `NotFoundError` |
| 2 | edge 없음 (update 반환 undefined) | `NotFoundError` |
| 3 | style만 변경 | 해당 필드만 포함 |

#### `remove`

| # | 케이스 | 검증 포인트 |
| - | ------ | ----------- |
| 1 | edge 없음 | `NotFoundError` |
| 2 | 정상 | `canvasEdgeRepository.delete` 호출 |

---

### [G] entities/canvas React Query hooks

**IPC mock** (`beforeEach`/`afterEach`):

```typescript
const mockFindByWorkspace = vi.fn()
const mockFindById = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateViewport = vi.fn()
const mockRemove = vi.fn()

const mockNodeFindByCanvas = vi.fn()
const mockNodeCreate = vi.fn()
const mockNodeUpdate = vi.fn()
const mockNodeUpdatePositions = vi.fn()
const mockNodeRemove = vi.fn()

const mockEdgeFindByCanvas = vi.fn()
const mockEdgeCreate = vi.fn()
const mockEdgeUpdate = vi.fn()
const mockEdgeRemove = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    canvas: {
      findByWorkspace: mockFindByWorkspace,
      findById: mockFindById,
      create: mockCreate,
      update: mockUpdate,
      updateViewport: mockUpdateViewport,
      remove: mockRemove
    },
    canvasNode: {
      findByCanvas: mockNodeFindByCanvas,
      create: mockNodeCreate,
      update: mockNodeUpdate,
      updatePositions: mockNodeUpdatePositions,
      remove: mockNodeRemove
    },
    canvasEdge: {
      findByCanvas: mockEdgeFindByCanvas,
      create: mockEdgeCreate,
      update: mockEdgeUpdate,
      remove: mockEdgeRemove
    }
  }
  vi.clearAllMocks()
})
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})
```

**QueryClientProvider wrapper** (모든 hook 공용):

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
```

#### queryKey 구조

```typescript
['canvas', 'workspace', workspaceId]    // useCanvasesByWorkspace
['canvas', 'detail', canvasId]          // useCanvasById
['canvasNode', 'canvas', canvasId]      // useCanvasNodes
['canvasEdge', 'canvas', canvasId]      // useCanvasEdges
```

#### `useCanvasesByWorkspace`

| # | 케이스 |
| - | ------ |
| 1 | 성공 → data 배열 반환 |
| 2 | `success:false` → `isError=true` |
| 3 | `workspaceId=''` → queryFn 미호출 (enabled=false) |
| 4 | `res.data=null` → `[]` 반환 (`?? []` 처리) |

#### `useCanvasById`

| # | 케이스 |
| - | ------ |
| 1 | 성공 → CanvasItem 반환 |
| 2 | `success:false` → `isError=true` |
| 3 | `canvasId=undefined` → enabled=false |

> `useCanvasById`는 `res.data!` 반환 (non-null assertion).
> list 쿼리(`?? []` fallback)와 달리 `res.data=null` 시 `null` 그대로 반환됨.

#### `useCanvasNodes`

| # | 케이스 |
| - | ------ |
| 1 | 성공 → CanvasNodeItem[] 반환 |
| 2 | `success:false` → `isError=true` |
| 3 | `canvasId=undefined` → enabled=false |
| 4 | `res.data=null` → `[]` 반환 |

#### `useCanvasEdges`

| # | 케이스 |
| - | ------ |
| 1 | 성공 → CanvasEdgeItem[] 반환 |
| 2 | `success:false` → `isError=true` |
| 3 | `canvasId=undefined` → enabled=false |
| 4 | `res.data=null` → `[]` 반환 |

#### 뮤테이션 hooks — IPC 인자 및 invalidation

| Hook | mutationFn IPC 호출 | invalidate queryKey |
| ---- | -------------------- | ------------------- |
| `useCreateCanvas` | `canvas.create(workspaceId, data)` | `['canvas', 'workspace', workspaceId]` |
| `useUpdateCanvas` | `canvas.update(canvasId, data)` | workspace list + `setQueryData(['canvas', 'detail', result.id], result)` — **`result.id`** 사용 |
| `useUpdateCanvasViewport` | `canvas.updateViewport(canvasId, viewport)` | 없음 (fire-and-forget, `useQueryClient` 미호출) |
| `useRemoveCanvas` | `canvas.remove(canvasId)` | `['canvas', 'workspace', workspaceId]` |
| `useCreateCanvasNode` | `canvasNode.create(canvasId, data)` | `['canvasNode', 'canvas', canvasId]` |
| `useUpdateCanvasNode` | `canvasNode.update(nodeId, data)` | `['canvasNode', 'canvas', canvasId]` |
| `useUpdateCanvasNodePositions` | `canvasNode.updatePositions(updates)` — **canvasId 미전달** (invalidation에만 사용) | `['canvasNode', 'canvas', canvasId]` |
| `useRemoveCanvasNode` | `canvasNode.remove(nodeId)` | node list **+ edge list** (FK cascade) |
| `useCreateCanvasEdge` | `canvasEdge.create(canvasId, data)` | `['canvasEdge', 'canvas', canvasId]` |
| `useUpdateCanvasEdge` | `canvasEdge.update(edgeId, data)` | `['canvasEdge', 'canvas', canvasId]` |
| `useRemoveCanvasEdge` | `canvasEdge.remove(edgeId)` | `['canvasEdge', 'canvas', canvasId]` |

> `useRemoveCanvasNode`: edge list도 함께 invalidate — FK cascade로 연결 엣지 자동 삭제되므로

---

## 5. 구현 순서

```
1. canvasRepository 테스트 (setup.ts 수정 불필요)
2. canvasNodeRepository 테스트 (canvas FK 의존)
3. canvasEdgeRepository 테스트 (canvas + node FK 의존)
4. canvasService 테스트 (repository 전체 mock)
5. canvasNodeService 테스트 (repository 전체 mock, batchFetchRefs 핵심)
6. canvasEdgeService 테스트 (repository 전체 mock, validation 로직 풍부)
7. entities/canvas queries 테스트 (renderHook + IPC mock)
```

---

## 6. 코드 스타일 규칙

| 항목 | 규칙 |
| ---- | ---- |
| Node 테스트 | `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import |
| Renderer 테스트 | `import { renderHook, act, waitFor } from '@testing-library/react'` |
| Service mock | `vi.mock(경로, () => ({ ... }))` 최상단 선언 (hoisting 필요) |
| 언어 | 한국어 describe/it 메시지 |
| 코드 스타일 | 세미콜론 없음, 작은따옴표, trailing comma 없음 |

---

## 7. 완료 기준

> `npm run test` — Node 테스트만 실행
> `npm run test:web` — Web 테스트만 실행
> **둘 다 통과해야 완료**

- `npm run test` 전체 통과 (repository × 3 + service × 3)
- `npm run test:web` 전체 통과 (queries)
- `npm run typecheck` 오류 없음
- 총 케이스 수: **75건 이상**
  - Repository (canvas): ~10건
  - Repository (canvas-node): ~12건
  - Repository (canvas-edge): ~8건
  - Service (canvas): ~13건 (updateViewport updatedAt 미갱신 포함)
  - Service (canvas-node): ~17건 (batchFetchRefs image description 분리 + fetchRefData 2건)
  - Service (canvas-edge): ~15건 (역방향 엣지 허용 케이스 포함)
  - Queries: ~25건 (query 4개 + mutation 11개)
