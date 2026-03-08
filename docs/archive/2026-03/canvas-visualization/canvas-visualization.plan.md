# Plan: Canvas Visualization Tool

> 작성일: 2026-03-02
> 기능: canvas-visualization
> 레벨: Dynamic
> Author: JIN | Version: 2.4 (4차 정밀 점검 반영)

---

## 1. 배경 및 목적

Obsidian Canvas 스타일의 무한 캔버스 시각화 도구를 Rally 앱에 통합한다. 기존 앱의 Todo, Note, Calendar, CSV, PDF, Image 데이터를 시각적으로 배치하고 연결하는 레이어로 동작한다.

**핵심 기능:**

- **자유 캔버스**: 무한 공간에서 줌/팬, 자유로운 노드 배치
- **노드 간 연결 시각화**: 베지어 커브 엣지로 관계 표현
- **ref_id 연동**: 기존 todo/note/schedule/csv/pdf/image 데이터와 실시간 동기화
- **자동 레이아웃**: Dagre 기반 마인드맵/계층 구조 자동 정렬
- **다른 모든 요소와 link**: Entity Link 시스템 통합

---

## 2. 기술 선택

| 항목            | 선택                                 | 사유                                                                                                                                                   |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 캔버스 엔진     | `@xyflow/react` v12 (~40-50KB gzip)  | 줌/팬/노드드래그/엣지/미니맵/컬링 내장. MIT 라이선스. 주간 190만 DL. React 커스텀 노드 1등 시민. 내부적으로 Zustand 사용하여 기존 아키텍처와 완벽 호환 |
| 자동 레이아웃   | `@dagrejs/dagre` v2.0 (~30KB)        | 계층형(Sugiyama) 레이아웃. 가볍고 React Flow 공식 연동 예제 제공. 커뮤니티 포크로 활발 유지보수                                                        |
| 클라이언트 상태 | Zustand (React Flow controlled mode) | React Flow의 공식 Zustand 연동 패턴 사용. `applyNodeChanges`/`applyEdgeChanges` 유틸로 변경 관리                                                       |
| 서버 상태       | TanStack React Query                 | DB에서 초기 로드, 캔버스 목록 조회                                                                                                                     |

**라이브러리 선택 근거 (조사 결과):**

| 후보                             | 판정     | 사유                                                                 |
| -------------------------------- | -------- | -------------------------------------------------------------------- |
| 자체 구현 (CSS Transform + SVG)  | 불채택   | 줌/팬/드래그/엣지/컬링/미니맵 전부 직접 구현 필요. 수주~수개월 공수  |
| `@xyflow/react` (React Flow v12) | **채택** | 위 모든 기능 내장. 커스텀 React 노드, 베지어 엣지, Zustand 연동, MIT |
| `react-konva` (Canvas2D)         | 불채택   | React 컴포넌트를 노드 내부에 렌더링 불가 (DOM 기반 아님)             |
| `@pixi/react` (WebGL)            | 불채택   | 200-500 노드에 WebGL 과잉. React 컴포넌트 노드 불가                  |
| `tldraw`                         | 불채택   | 상용 라이선스 필수 (MIT 아님). 화이트보드 특화, 노드-그래프 아님     |
| `@excalidraw/excalidraw`         | 불채택   | 드로잉 도구 특화. 구조화된 노드/엣지 API 없음                        |
| `@antv/x6`                       | 불채택   | 문서 대부분 중국어. 커뮤니티 1/10 수준                               |

---

## 3. UI 흐름

```
사이드바 "캔버스" 클릭 (캘린더 아래, 5번째 항목)
  → 캔버스 리스트 페이지 (openTab, type: 'canvas')
    → 추가 버튼 클릭 → 새 캔버스 생성
    → 리스트 아이템 클릭 → 캔버스 디테일 페이지 (openTab, type: 'canvas-detail')
      → title, description 수정 가능
      → 캔버스 영역 (ReactFlow 컴포넌트)
```

---

## 4. Data Model (Drizzle ORM)

### 4.1 canvases 테이블

```typescript
// src/main/db/schema/canvas.ts
export const canvases = sqliteTable(
  'canvases',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    viewportX: real('viewport_x').notNull().default(0),
    viewportY: real('viewport_y').notNull().default(0),
    viewportZoom: real('viewport_zoom').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvases_workspace').on(t.workspaceId)]
)
```

### 4.2 canvas_nodes 테이블

```typescript
// src/main/db/schema/canvas-node.ts
import { isNotNull } from 'drizzle-orm'
import type { LinkableEntityType } from './entity-link'

// 캔버스 노드 타입 = 'text' (캔버스 전용) + 기존 엔티티 타입 전체
export type CanvasNodeType = 'text' | LinkableEntityType
export const CANVAS_NODE_TYPES: CanvasNodeType[] = [
  'text',
  'todo',
  'note',
  'schedule',
  'csv',
  'pdf',
  'image'
]

export const canvasNodes = sqliteTable(
  'canvas_nodes',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']
    }).notNull(),
    refId: text('ref_id'), // 기존 엔티티 ID (연동)
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull().default(260),
    height: real('height').notNull().default(160),
    color: text('color'), // 노드 배경색 (#hex)
    content: text('content'), // type='text'일 때 직접 입력 내용
    zIndex: integer('z_index').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_canvas_nodes_canvas').on(t.canvasId),
    // 부분 인덱스: ref_id가 있는 노드만 인덱싱 (text 노드 제외)
    index('idx_canvas_nodes_ref').on(t.type, t.refId).where(isNotNull(t.refId))
  ]
)
```

**노드 타입별 렌더링 (React Flow Custom Node):**

- `text` → 캔버스 전용 메모 카드 (마크다운 편집)
- `note` → 기존 노트 ref, 제목 + 미리보기 표시
- `todo` → 체크박스 + 상태 표시
- `schedule` → 일정 카드
- `csv` / `pdf` / `image` → 파일 임베드 카드

### 4.3 canvas_edges 테이블

```typescript
// src/main/db/schema/canvas-edge.ts
export const canvasEdges = sqliteTable(
  'canvas_edges',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    fromNode: text('from_node')
      .notNull()
      .references(() => canvasNodes.id, { onDelete: 'cascade' }),
    toNode: text('to_node')
      .notNull()
      .references(() => canvasNodes.id, { onDelete: 'cascade' }),
    fromSide: text('from_side').notNull().default('right'), // 'top' | 'right' | 'bottom' | 'left'
    toSide: text('to_side').notNull().default('left'),
    label: text('label'),
    color: text('color'),
    style: text('style').notNull().default('solid'), // 'solid' | 'dashed' | 'dotted'
    arrow: text('arrow').notNull().default('end'), // 'none' | 'end' | 'both'
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvas_edges_canvas').on(t.canvasId)]
)
```

### 4.4 canvas_groups 테이블 (Phase 2)

> 스키마 정의만 Phase 1에서 생성. 실제 사용은 Phase 2 그룹핑 구현 시.

```typescript
// src/main/db/schema/canvas-group.ts
export const canvasGroups = sqliteTable(
  'canvas_groups',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    label: text('label'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull(),
    height: real('height').notNull(),
    color: text('color'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvas_groups_canvas').on(t.canvasId)]
)
```

### 4.5 ERD

```
canvases (1) ───< canvas_nodes (N)
canvases (1) ───< canvas_edges (N)
canvases (1) ───< canvas_groups (N)
canvas_nodes.ref_id ───> todos.id / notes.id / schedules.id / ...
canvas_edges.from_node ───> canvas_nodes.id
canvas_edges.to_node ───> canvas_nodes.id
```

### 4.6 데이터 로딩 전략

**ref 데이터 로딩: type별 batch fetch 방식 채택**

6-way LEFT JOIN은 쿼리가 지나치게 복잡하고, 개별 ref fetch는 N+1 문제가 있다.
**중간 전략**: 노드를 먼저 로드한 뒤, type별로 refId를 모아 batch fetch한다.

```typescript
// Service 레이어 의사코드
function loadCanvasWithRefs(canvasId: string) {
  // 1. 노드 전체 로드 (단순 SELECT)
  const nodes = canvasNodeRepository.findByCanvasId(canvasId)

  // 2. type별 refId 수집
  const todoIds = nodes.filter((n) => n.type === 'todo' && n.refId).map((n) => n.refId!)
  const noteIds = nodes.filter((n) => n.type === 'note' && n.refId).map((n) => n.refId!)
  const scheduleIds = nodes.filter((n) => n.type === 'schedule' && n.refId).map((n) => n.refId!)
  // csv, pdf, image 동일 패턴

  // 3. batch fetch (WHERE id IN (...))
  const todos = todoIds.length ? todoRepository.findByIds(todoIds) : []
  const notes = noteIds.length ? noteRepository.findByIds(noteIds) : []
  // ...

  // 4. Map으로 merge
  const refMap = new Map<string, RefData>()
  for (const t of todos) refMap.set(t.id, { title: t.title, preview: t.status })
  for (const n of notes) refMap.set(n.id, { title: n.title, preview: n.preview })
  // ...

  return nodes.map((node) => ({
    ...node,
    refTitle: node.refId ? refMap.get(node.refId)?.title : undefined,
    refPreview: node.refId ? refMap.get(node.refId)?.preview : undefined
  }))
}
```

**장점**: 쿼리 최대 7개(노드 1 + type별 6), 각각 단순 SELECT. JOIN 복잡도 없음.
**Repository 확장**: 기존 repository에 `findByIds(ids: string[])` 메서드 추가 필요.

**기타 전략:**

- **드래그 중**: React Flow 내부 Zustand store만 업데이트, DB 쓰기 없음
- **드래그 종료**: `onNodesChange`에서 `dragging: false` 감지 → SQLite 트랜잭션으로 배치 저장
- **뷰포트 저장**: `onMoveEnd` 콜백 + 디바운스(500ms)로 viewport 상태 DB 저장

---

## 5. 상태 관리 설계

### 5.1 React Query vs Zustand vs React Flow 역할 분담

| 데이터                           | 관리 주체                             | 사유                             |
| -------------------------------- | ------------------------------------- | -------------------------------- |
| 캔버스 목록                      | React Query                           | DB 기반 서버 상태, 캐싱 활용     |
| 캔버스 초기 로드 (노드+엣지+ref) | React Query → Zustand                 | 초기 fetch 후 store에 hydrate    |
| 노드 위치/크기 (드래그 중)       | Zustand (React Flow controlled)       | `applyNodeChanges()` 활용, 60fps |
| 엣지 상태                        | Zustand (React Flow controlled)       | `applyEdgeChanges()` 활용        |
| 뷰포트 (x, y, zoom)              | React Flow 내부 (uncontrolled)        | `onMoveEnd`로 DB 저장만 수행     |
| 선택 상태                        | React Flow 내부                       | 내장 다중 선택, 선택 영역(lasso) |
| 엣지 연결 (드래그)               | React Flow 내부                       | `onConnect` 콜백으로 DB 저장     |
| 노드 위치 (드래그 종료)          | Zustand dirty → IPC → DB              | flush 대상 추적                  |
| 노드/엣지 CRUD                   | React Query mutation → Zustand 동기화 | 낙관적 업데이트                  |

### 5.2 캔버스 Zustand Store 구조 (React Flow controlled mode)

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges
} from '@xyflow/react'

interface CanvasStoreState {
  // React Flow 데이터 (controlled)
  nodes: Node[]
  edges: Edge[]

  // 더티 트래킹 (flush 대상)
  dirtyNodeIds: Set<string>
}

interface CanvasStoreActions {
  // 초기화
  hydrate: (nodes: Node[], edges: Edge[]) => void
  reset: () => void

  // React Flow 이벤트 핸들러 (controlled mode)
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  // onConnect, onNodesDelete, onEdgesDelete는 IPC mutation 필요 → 컴포넌트 훅(useCanvasData)에서 처리

  // 노드 CRUD (IPC 호출 후 store 동기화)
  addNode: (node: Node) => void
  removeNodes: (nodeIds: string[]) => void // 삭제 + 연결 엣지 필터링
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void

  // 엣지 CRUD (이름 주의: @xyflow/react의 addEdge 유틸과 충돌 방지)
  insertEdge: (edge: Edge) => void
  removeEdges: (edgeIds: string[]) => void

  // ref 데이터 갱신 (탭 활성화 시 부분 refetch 후 호출)
  updateRefData: (refMap: Map<string, { title: string; preview: string }>) => void

  // flush
  getDirtyPositions: () => { id: string; x: number; y: number }[]
  clearDirty: () => void
}

type CanvasStore = CanvasStoreState & CanvasStoreActions

// store 생성 시 devtools 미들웨어 래핑 (기존 useTabStore 패턴)
// export const useCanvasStore = create<CanvasStore>()(devtools((set, get) => ({ ... })))
```

**핵심: `onNodesChange`에서 드래그 종료 감지**

```typescript
onNodesChange: (changes) => {
  // 드래그 종료 감지 → dirty 마킹
  // ⚠️ Set을 직접 mutation하면 Zustand가 변경 감지 불가 → 반드시 새 Set 생성
  let newDirtyIds: Set<string> | null = null
  for (const change of changes) {
    if (change.type === 'position' && change.dragging === false && change.position) {
      if (!newDirtyIds) newDirtyIds = new Set(get().dirtyNodeIds)
      newDirtyIds.add(change.id)
    }
  }
  set({
    nodes: applyNodeChanges(changes, get().nodes),
    ...(newDirtyIds ? { dirtyNodeIds: newDirtyIds } : {})
  })
}
```

**`useCanvasData(canvasId)` 훅 반환값:**

```typescript
interface UseCanvasDataReturn {
  isLoading: boolean                    // React Query fetch 진행 중 (hydration 전 ReactFlow 마운트 방지)
  savedViewport: Viewport | undefined   // DB에 저장된 viewport (x, y, zoom)
  handleConnect: (connection: Connection) => void
  handleNodesDelete: (nodes: Node[]) => void
  handleEdgesDelete: (edges: Edge[]) => void
  createNodeMutation: UseMutationResult<...>   // 노드 생성 (더블클릭)
  updateViewportMutation: UseMutationResult<...>  // 뷰포트 저장 (디바운스)
}
```

**데이터 흐름:**

```
캔버스 열기: React Query fetch → DB→RF 변환 → store.hydrate() → isLoading=false → ReactFlow 마운트
뷰포트 복원: hydration 완료 후 마운트 → defaultViewport(savedViewport) 적용 (uncontrolled prop)
빈 캔버스: nodes.length===0 → fitView 적용 (defaultViewport보다 우선)
노드 드래그: React Flow onNodesChange → applyNodeChanges (메모리만)
드래그 종료: onNodesChange(dragging:false) → 새 Set으로 dirtyNodeIds 갱신
Flush 트리거: useEffect로 dirtyNodeIds 참조 변경 감지 → IPC bulkUpdatePositions → clearDirty()
노드 추가: IPC mutation → onSuccess → store.addNode(RF Node)
엣지 연결: React Flow onConnect → useCanvasData.handleConnect() → IPC create → store.insertEdge(RF Edge)
노드 삭제: React Flow onNodesDelete → useCanvasData.handleNodesDelete() → store.removeNodes(ids) + IPC remove (각각)
엣지 삭제: React Flow onEdgesDelete → useCanvasData.handleEdgesDelete() → store.removeEdges(ids) + IPC remove (각각)
더블클릭 노드 생성: screenToFlowPosition(clientX, clientY) → createNodeMutation → store.addNode(RF Node)
뷰포트 이동: onMoveEnd → useRef+setTimeout 디바운스(500ms) → updateViewportMutation
ref 데이터 갱신: 탭 활성화 시 ref 데이터만 부분 refetch → store의 node.data 업데이트 (position 보존)
캔버스 닫기: dirtyNodeIds flush → store.reset()
```

> **v12 `onDelete` 대안**: React Flow v12은 `onDelete({ nodes, edges })` 통합 콜백도 제공. 현재 플랜은 `onNodesDelete`/`onEdgesDelete`를 분리하여 사용하지만, 구현 시 `onDelete` 하나로 통합해도 무방.

---

## 6. Frontend Rendering — React Flow 통합

### 6.1 React Flow 기본 구조

```tsx
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// nodeTypes는 컴포넌트 외부에서 정의 (리렌더링 방지)
const nodeTypes = {
  text: TextNodeComponent,
  todo: TodoRefNode,
  note: NoteRefNode,
  schedule: ScheduleRefNode,
  csv: FileRefNode,
  pdf: FileRefNode,
  image: FileRefNode
}

const edgeTypes = {
  custom: CustomAnimatedEdge
}

// 외부 셸: ReactFlowProvider를 제공
function CanvasBoard({ canvasId }: { canvasId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner canvasId={canvasId} />
    </ReactFlowProvider>
  )
}

// 내부 컴포넌트: useReactFlow() 훅 사용 가능 (Provider 내부)
function CanvasBoardInner({ canvasId }: { canvasId: string }) {
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasStore()
  const {
    isLoading,
    savedViewport,
    handleConnect,
    handleNodesDelete,
    handleEdgesDelete,
    createNodeMutation,
    updateViewportMutation
  } = useCanvasData(canvasId)
  const { screenToFlowPosition } = useReactFlow()

  // 빈 공간 더블클릭 → 새 text 노드 생성
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      createNodeMutation.mutate({ canvasId, data: { type: 'text', x: position.x, y: position.y } })
    },
    [canvasId, screenToFlowPosition, createNodeMutation]
  )

  // 뷰포트 변경 → 디바운스(500ms) → DB 저장 (코드베이스 패턴: useRef + setTimeout)
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleViewportSave = useCallback(
    (viewport: Viewport) => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
      viewportTimerRef.current = setTimeout(() => {
        updateViewportMutation.mutate({ canvasId, viewport })
      }, 500)
    },
    [canvasId, updateViewportMutation]
  )
  useEffect(() => {
    return () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
    }
  }, [])

  // ⚠️ hydration 완료 전 ReactFlow 마운트 방지
  // defaultViewport/fitView는 초기 렌더 시에만 적용되는 uncontrolled prop.
  // 데이터 로딩 중 마운트하면 nodes=[] → fitView=true 항상 발동 → savedViewport 무시됨.
  // hydration 완료 후 마운트해야 nodes.length와 savedViewport가 정확.
  if (isLoading) return <LoadingSpinner />

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onNodesDelete={handleNodesDelete} // Delete키 → IPC 삭제 + 연결 엣지 정리
      onEdgesDelete={handleEdgesDelete} // Delete키 → IPC 삭제
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: 'custom' }}
      connectionMode={ConnectionMode.Loose}
      onlyRenderVisibleElements
      snapToGrid
      snapGrid={[20, 20]}
      defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 1 }}
      fitView={nodes.length === 0}
      onMoveEnd={(_, viewport) => handleViewportSave(viewport)}
      onDoubleClick={handleDoubleClick}
    >
      <Controls />
      <MiniMap />
      <Background variant={BackgroundVariant.Dots} gap={20} />
    </ReactFlow>
  )
}
```

> **컴포넌트 분리 이유**: `useReactFlow()` 훅은 `<ReactFlowProvider>` **내부**에서만 호출 가능. `CanvasBoard`가 Provider를 제공하므로, `screenToFlowPosition()` 등을 사용하는 로직은 내부 `CanvasBoardInner`에 배치.
> **hydration 대기**: `isLoading` 가드로 React Query fetch 완료 전 `<ReactFlow>` 마운트를 방지. `defaultViewport`/`fitView`는 초기 렌더 시에만 적용되는 uncontrolled prop이므로, nodes 데이터와 savedViewport가 확정된 후 마운트해야 정확한 뷰포트 복원이 보장됨.
> **디바운스 패턴**: 기존 코드베이스(NoteEditor, useCsvEditor)의 `useRef + setTimeout` 수동 패턴을 따름. 외부 라이브러리(`use-debounce`, `usehooks-ts`) 불필요.

### 6.2 DB ↔ React Flow 데이터 변환

```typescript
// DB 모델 → React Flow Node
function toReactFlowNode(item: CanvasNodeItem): Node {
  return {
    id: item.id,
    type: item.type, // nodeTypes 레지스트리 키와 일치
    position: { x: item.x, y: item.y },
    data: {
      content: item.content,
      color: item.color,
      refId: item.refId,
      refTitle: item.refTitle,
      refPreview: item.refPreview
    },
    style: { width: item.width, height: item.height },
    zIndex: item.zIndex
  }
}

// DB 모델 → React Flow Edge
// ⚠️ markerEnd/markerStart는 Edge 데이터 레벨에서 설정 — React Flow가 내부적으로 SVG <defs> 생성 후 string URL로 변환
function toReactFlowEdge(item: CanvasEdgeItem): Edge {
  const edgeColor = item.color || '#666'
  return {
    id: item.id,
    source: item.fromNode,
    target: item.toNode,
    sourceHandle: item.fromSide, // 'top' | 'right' | 'bottom' | 'left'
    targetHandle: item.toSide,
    type: 'custom',
    markerEnd:
      item.arrow !== 'none' ? { type: MarkerType.ArrowClosed, color: edgeColor } : undefined,
    markerStart:
      item.arrow === 'both' ? { type: MarkerType.ArrowClosed, color: edgeColor } : undefined,
    data: {
      label: item.label,
      color: item.color,
      style: item.style, // 'solid' | 'dashed' | 'dotted'
      arrow: item.arrow // 'none' | 'end' | 'both'
    }
  }
}

// React Flow Node → DB 위치 업데이트
function toPositionUpdate(node: Node): { id: string; x: number; y: number } {
  return { id: node.id, x: node.position.x, y: node.position.y }
}
```

### 6.3 커스텀 노드 구조

각 노드 타입은 React 컴포넌트. React Flow가 `Handle` 컴포넌트로 연결 포인트를 제공한다.

```tsx
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

// 커스텀 노드 데이터 타입 정의 (NodeProps 제네릭 필수 — 없으면 data가 Record<string, unknown>)
type TextNodeData = { content?: string | null; color?: string | null }
type TextNode = Node<TextNodeData, 'text'>

function TextNodeComponent({ data, selected }: NodeProps<TextNode>) {
  return (
    <div
      className={cn('rounded-lg border bg-card p-3 shadow-sm', selected && 'ring-2 ring-primary')}
    >
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <div className="text-sm">{data.content}</div>
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
    </div>
  )
}

// RefNodeData도 동일 패턴
type RefNodeData = {
  refId?: string | null
  refTitle?: string
  refPreview?: string
  color?: string | null
}
type RefNode = Node<RefNodeData, 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'>
// function TodoRefNode({ data, selected }: NodeProps<RefNode>) { ... }
```

**Handle 매핑**:

- 모든 Handle은 `type="source"` + `connectionMode={ConnectionMode.Loose}`로 **어떤 방향이든 자유 연결** 허용
- 각 Handle의 `id` prop (`'top'|'right'|'bottom'|'left'`)이 DB의 `fromSide`/`toSide`와 직접 매핑
- `id` 없이 핸들이 2개 이상이면 React Flow가 구분 불가 → `sourceHandle`/`targetHandle`이 null이 됨 (필수)

### 6.4 React Flow 내장 기능 활용 (자체 구현 불필요)

| 기능                    | React Flow 제공              | 이전 플랜 (자체 구현)             |
| ----------------------- | ---------------------------- | --------------------------------- |
| 줌/팬                   | `<ReactFlow>` 내장           | CSS transform + wheel 수학        |
| 마우스 포인터 중심 줌   | 내장 (기본 동작)             | 좌표 역산 공식 직접 구현          |
| 노드 드래그             | 내장 (onNodesChange)         | mousedown/move/up 직접 구현       |
| 노드 다중 선택          | 내장 (Shift+클릭, 선택 영역) | selectedNodeIds Set 직접 관리     |
| 미니맵                  | `<MiniMap />`                | Phase 4 직접 구현                 |
| 배경 그리드             | `<Background />`             | 없음                              |
| 뷰포트 컬링             | `onlyRenderVisibleElements`  | Phase 3 직접 구현                 |
| 스냅 그리드             | `snapToGrid + snapGrid`      | Phase 3 직접 구현                 |
| 줌 컨트롤 UI            | `<Controls />`               | CanvasToolbar 직접 구현           |
| 엣지 연결 (핸들 드래그) | `onConnect` 내장             | 앵커 포인트 + 임시 엣지 직접 구현 |
| 베지어 커브 엣지        | 내장 (default edge type)     | SVG path 수학 직접 구현           |
| 엣지 히트 영역          | 내장 (투명 히트 영역 자동)   | 20px 투명 path 직접 구현          |

---

## 7. Edge System

### 7.1 React Flow 엣지 타입

React Flow 내장 엣지 타입: `default`(bezier), `straight`, `step`, `smoothstep`.
커스텀 엣지 컴포넌트로 스타일(색상, 점선, 화살표)과 애니메이션을 추가한다.

### 7.2 커스텀 엣지 컴포넌트

```tsx
import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

function CustomAnimatedEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    markerStart
  } = props
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  })

  const edgeColor = data?.color || '#666'

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeDasharray:
            data?.style === 'dashed' ? '6 4' : data?.style === 'dotted' ? '2 4' : undefined
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all' // EdgeLabelRenderer는 기본 pointer-events: none
            }}
            className="nodrag nopan rounded bg-background px-2 py-0.5 text-xs border shadow-sm"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
```

> **마커 패턴**: `markerEnd`/`markerStart`는 `toReactFlowEdge()`에서 객체 형태(`{ type: MarkerType.ArrowClosed, color }`)로 Edge에 설정. React Flow가 내부적으로 SVG `<defs>` 마커를 생성하고 string URL로 변환. 커스텀 엣지에서는 `props.markerEnd` (string)을 `BaseEdge`에 패스스루.
> **EdgeLabelRenderer 인터랙션**: 기본 `pointer-events: none`이므로 라벨 클릭이 필요하면 `pointerEvents: 'all'` + `nodrag nopan` 클래스 필수.

### 7.3 연결 제약 조건

`onConnect` 콜백은 React Query mutation이 필요하므로 **컴포넌트 훅(useCanvasData)에서 처리** (Zustand store action 아님):

```typescript
// useCanvasData 훅 내부
const handleConnect = useCallback(
  (connection: Connection) => {
    // Self-loop 불가
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) return
    // 같은 방향 중복 엣지 불가
    const edges = useCanvasStore.getState().edges
    const exists = edges.some(
      (e) => e.source === connection.source && e.target === connection.target
    )
    if (exists) return
    // A→B + B→A 양방향은 허용
    // IPC로 DB 저장 후 store.insertEdge()로 동기화
    createEdgeMutation.mutate({ canvasId, data: toCreateCanvasEdgeData(connection) })
  },
  [canvasId]
)
```

> `connection.source`/`.target`은 `string | null`이므로 null 체크 필수.

### 7.4 삭제 핸들러 (DB 영속화)

React Flow controlled mode에서 Delete 키 → `onNodesChange(type: 'remove')` → `applyNodeChanges()`가 store에서 제거하지만, **DB 삭제는 자동이 아님**. `onNodesDelete`/`onEdgesDelete` 콜백으로 IPC 호출을 수행한다.

```typescript
// useCanvasData 훅 내부
const handleNodesDelete = useCallback((deletedNodes: Node[]) => {
  // 1. 연결된 엣지도 store에서 제거
  const deletedIds = new Set(deletedNodes.map((n) => n.id))
  const connectedEdges = useCanvasStore
    .getState()
    .edges.filter((e) => deletedIds.has(e.source) || deletedIds.has(e.target))
  if (connectedEdges.length > 0) {
    useCanvasStore.getState().removeEdges(connectedEdges.map((e) => e.id))
  }

  // 2. 각 노드를 IPC로 DB 삭제 (FK CASCADE가 DB 엣지도 삭제)
  for (const node of deletedNodes) {
    removeNodeMutation.mutate(node.id)
  }
}, [])

const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
  for (const edge of deletedEdges) {
    removeEdgeMutation.mutate(edge.id)
  }
}, [])
```

> `onNodesDelete`는 `onNodesChange(type: 'remove')` **이후**에 호출됨. store에서 노드는 이미 제거된 상태이므로, 여기서는 DB 삭제 + 연결 엣지 정리만 수행.

---

## 8. Animation System

| 대상          | 기법                                                      | 시간 |
| ------------- | --------------------------------------------------------- | ---- |
| 엣지 생성     | 커스텀 엣지에서 stroke-dasharray/dashoffset draw          | 0.4s |
| 엣지 삭제     | CSS transition opacity (React Flow가 DOM에서 제거 전)     | 0.3s |
| 자동 레이아웃 | requestAnimationFrame + easeOutCubic (노드 position 보간) | 0.5s |
| 노드 추가     | CSS animation scale-in (커스텀 노드 내부)                 | 0.2s |

> React Flow는 엣지 연결 시 임시 선(connection line)을 자동 렌더링. 드래프트 엣지 자체 구현 불필요.

---

## 9. Auto Layout — @dagrejs/dagre (Phase 3)

### 9.1 레이아웃 프리셋

| 프리셋     | 방향 | 용도             |
| ---------- | ---- | ---------------- |
| mindmap    | LR   | 마인드맵 시각화  |
| hierarchy  | TB   | 조직도/계층 구조 |
| timeline   | LR   | 시간순 타임라인  |
| dependency | LR   | 태스크 의존관계  |

### 9.2 React Flow + Dagre 연동

React Flow 공식 dagre 예제 패턴 사용:

```typescript
import dagre from '@dagrejs/dagre'

const computeLayout = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR') => {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    g.setNode(node.id, { width: node.measured?.width ?? 260, height: node.measured?.height ?? 160 })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - (node.measured?.width ?? 260) / 2,
        y: pos.y - (node.measured?.height ?? 160) / 2
      }
    }
  })
}
```

> `node.measured` 활용: React Flow가 실제 렌더링된 노드 크기를 측정하여 제공. dagre에 정확한 크기 전달 가능.

### 9.3 레이아웃 적용

- 선택 노드만 정렬 (부분 레이아웃) 지원
- 고립 노드(orphan)는 메인 레이아웃 아래 가로 나열
- 레이아웃 후 `setNodes()`로 위치 반영 → `onNodesChange` 트리거 → dirty 마킹 → DB flush

---

## 10. IPC 채널 명세

### 10.1 canvas 채널

| 채널                     | 인자                                         | 반환                        | 설명        |
| ------------------------ | -------------------------------------------- | --------------------------- | ----------- |
| `canvas:findByWorkspace` | `workspaceId`                                | `IpcResponse<CanvasItem[]>` | 캔버스 목록 |
| `canvas:findById`        | `canvasId`                                   | `IpcResponse<CanvasItem>`   | 단일 캔버스 |
| `canvas:create`          | `workspaceId, data: { title, description? }` | `IpcResponse<CanvasItem>`   | 캔버스 생성 |
| `canvas:update`          | `canvasId, data: { title?, description? }`   | `IpcResponse<CanvasItem>`   | 메타 수정   |
| `canvas:updateViewport`  | `canvasId, viewport: { x, y, zoom }`         | `IpcResponse<void>`         | 뷰포트 저장 |
| `canvas:remove`          | `canvasId`                                   | `IpcResponse<void>`         | 캔버스 삭제 |

### 10.2 canvasNode 채널

| 채널                         | 인자                                   | 반환                            | 설명                             |
| ---------------------------- | -------------------------------------- | ------------------------------- | -------------------------------- |
| `canvasNode:findByCanvas`    | `canvasId`                             | `IpcResponse<CanvasNodeItem[]>` | 노드 전체 (ref 데이터 포함)      |
| `canvasNode:create`          | `canvasId, data: CreateCanvasNodeData` | `IpcResponse<CanvasNodeItem>`   | 노드 생성                        |
| `canvasNode:update`          | `nodeId, data: UpdateCanvasNodeData`   | `IpcResponse<CanvasNodeItem>`   | 노드 수정 (content, color, size) |
| `canvasNode:updatePositions` | `updates: { id, x, y }[]`              | `IpcResponse<void>`             | 벌크 위치 업데이트 (트랜잭션)    |
| `canvasNode:remove`          | `nodeId`                               | `IpcResponse<void>`             | 노드 삭제 (연결 엣지 CASCADE)    |

### 10.3 canvasEdge 채널

| 채널                      | 인자                                   | 반환                            | 설명                                   |
| ------------------------- | -------------------------------------- | ------------------------------- | -------------------------------------- |
| `canvasEdge:findByCanvas` | `canvasId`                             | `IpcResponse<CanvasEdgeItem[]>` | 엣지 전체                              |
| `canvasEdge:create`       | `canvasId, data: CreateCanvasEdgeData` | `IpcResponse<CanvasEdgeItem>`   | 엣지 생성 (유효성 검사 포함)           |
| `canvasEdge:update`       | `edgeId, data: UpdateCanvasEdgeData`   | `IpcResponse<CanvasEdgeItem>`   | 엣지 수정 (label, color, style, sides) |
| `canvasEdge:remove`       | `edgeId`                               | `IpcResponse<void>`             | 엣지 삭제                              |

> 모든 채널은 기존 `handle()` 래퍼 패턴 사용. `selectFile` 같은 다이얼로그 핸들러는 없음 (파일시스템 무관).

---

## 11. Preload Bridge 타입 명세

### 11.1 데이터 타입

```typescript
// src/preload/index.d.ts 에 추가

interface CanvasItem {
  id: string
  workspaceId: string
  title: string
  description: string
  viewportX: number
  viewportY: number
  viewportZoom: number
  createdAt: Date
  updatedAt: Date
}

interface CanvasNodeItem {
  id: string
  canvasId: string
  type: 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
  refId: string | null
  x: number
  y: number
  width: number
  height: number
  color: string | null
  content: string | null
  zIndex: number
  createdAt: Date
  updatedAt: Date
  // ref batch fetch 결과 (서비스 레이어에서 merge)
  refTitle?: string
  refPreview?: string
}

interface CanvasEdgeItem {
  id: string
  canvasId: string
  fromNode: string
  toNode: string
  fromSide: 'top' | 'right' | 'bottom' | 'left'
  toSide: 'top' | 'right' | 'bottom' | 'left'
  label: string | null
  color: string | null
  style: 'solid' | 'dashed' | 'dotted'
  arrow: 'none' | 'end' | 'both'
  createdAt: Date
}

interface CreateCanvasNodeData {
  type: CanvasNodeItem['type']
  refId?: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  content?: string
}

interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}

interface CreateCanvasEdgeData {
  fromNode: string
  toNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  arrow?: 'none' | 'end' | 'both'
}

interface UpdateCanvasEdgeData {
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  arrow?: 'none' | 'end' | 'both'
}
```

### 11.2 API 인터페이스

```typescript
interface CanvasAPI {
  findByWorkspace: (workspaceId: string) => Promise<IpcResponse<CanvasItem[]>>
  findById: (canvasId: string) => Promise<IpcResponse<CanvasItem>>
  create: (
    workspaceId: string,
    data: { title: string; description?: string }
  ) => Promise<IpcResponse<CanvasItem>>
  update: (
    canvasId: string,
    data: { title?: string; description?: string }
  ) => Promise<IpcResponse<CanvasItem>>
  updateViewport: (
    canvasId: string,
    viewport: { x: number; y: number; zoom: number }
  ) => Promise<IpcResponse<void>>
  remove: (canvasId: string) => Promise<IpcResponse<void>>
}

interface CanvasNodeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasNodeItem[]>>
  create: (canvasId: string, data: CreateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  update: (nodeId: string, data: UpdateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  updatePositions: (updates: { id: string; x: number; y: number }[]) => Promise<IpcResponse<void>>
  remove: (nodeId: string) => Promise<IpcResponse<void>>
}

interface CanvasEdgeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasEdgeItem[]>>
  create: (canvasId: string, data: CreateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  update: (edgeId: string, data: UpdateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  remove: (edgeId: string) => Promise<IpcResponse<void>>
}

// API 인터페이스에 추가
interface API {
  // ... 기존
  canvas: CanvasAPI
  canvasNode: CanvasNodeAPI
  canvasEdge: CanvasEdgeAPI
}
```

---

## 12. 구현 범위

### Phase 1: 캔버스 코어 + 엣지 (MVP)

> 목표: 캔버스 CRUD + 노드 생성/이동 + 엣지 연결 + 뷰포트 줌/팬
> React Flow 덕분에 기존 Phase 1+2를 합칠 수 있음.

#### 1-A. Main Process (DB + 백엔드)

**스키마 (4개 파일)** — 마이그레이션 포함:

- `src/main/db/schema/canvas.ts` — canvases 테이블
- `src/main/db/schema/canvas-node.ts` — canvas_nodes 테이블
- `src/main/db/schema/canvas-edge.ts` — canvas_edges 테이블
- `src/main/db/schema/canvas-group.ts` — canvas_groups 테이블 (스키마만, Phase 3 사용)
- `src/main/db/schema/index.ts` — export 추가

**Repository (3개 파일)**:

- `src/main/repositories/canvas.ts` — findByWorkspaceId, findById, create, update, updateViewport, remove
- `src/main/repositories/canvas-node.ts` — findByCanvasId, findById, create, update, bulkUpdatePositions, remove
- `src/main/repositories/canvas-edge.ts` — findByCanvasId, findById, create, update, remove

**기존 Repository 확장** — ref batch fetch용:

- `src/main/repositories/todo.ts` — `findByIds(ids: string[])` 추가
- `src/main/repositories/note.ts` — `findByIds(ids: string[])` 추가
- `src/main/repositories/schedule.ts` — `findByIds(ids: string[])` 추가
- `src/main/repositories/csv-file.ts` — `findByIds(ids: string[])` 추가
- `src/main/repositories/pdf-file.ts` — `findByIds(ids: string[])` 추가
- `src/main/repositories/image-file.ts` — `findByIds(ids: string[])` 추가

**Service (3개 파일)**:

- `src/main/services/canvas.ts` — 캔버스 CRUD + viewport 저장 + `toCanvasItem()` 변환 함수
- `src/main/services/canvas-node.ts` — 노드 CRUD + 위치 벌크 업데이트 + ref batch fetch + `toCanvasNodeItem()` 변환 함수
- `src/main/services/canvas-edge.ts` — 엣지 CRUD + 유효성 검사 (self-loop, 중복) + `toCanvasEdgeItem()` 변환 함수

**IPC (3개 파일)**:

- `src/main/ipc/canvas.ts` — canvas:\* 채널 (6개)
- `src/main/ipc/canvas-node.ts` — canvasNode:\* 채널 (5개)
- `src/main/ipc/canvas-edge.ts` — canvasEdge:\* 채널 (4개)

#### 1-B. Preload Bridge

**파일**: `src/preload/index.d.ts` + `src/preload/index.ts`

- CanvasItem, CanvasNodeItem, CanvasEdgeItem + Create/Update 타입 정의
- CanvasAPI (6), CanvasNodeAPI (5), CanvasEdgeAPI (4) 인터페이스 + 구현
- API 인터페이스에 `canvas`, `canvasNode`, `canvasEdge` 추가

#### 1-C. Renderer — 기반 레이어

**탭 시스템 등록** (`tab-url.ts`):

```typescript
// TabType에 'canvas' | 'canvas-detail' 추가
// ROUTES에 CANVAS: '/canvas', CANVAS_DETAIL: '/canvas/:canvasId' 추가
// TAB_ICON에 canvas: Workflow (lucide-react), 'canvas-detail': Workflow 추가
// sidebar_items에 캔버스 항목 추가 (캘린더 다음)
```

**Entity 레이어** (`src/renderer/src/entities/canvas/`):

```
model/queries.ts    → useCanvasesByWorkspace, useCreateCanvas, useUpdateCanvas,
                      useRemoveCanvas, useCanvasNodes, useCreateNode,
                      useUpdateNode, useUpdateNodePositions, useRemoveNode,
                      useCanvasEdges, useCreateEdge, useUpdateEdge, useRemoveEdge
model/types.ts      → CanvasItem, CanvasNodeItem, CanvasEdgeItem (preload 타입 re-export)
model/converters.ts → toReactFlowNode(), toReactFlowEdge(), toPositionUpdate(), toCreateCanvasEdgeData()
index.ts            → barrel export
```

> 기존 entity 패턴 준수: `entities/todo/model/queries.ts`, `entities/todo/model/types.ts` (api/ 아님)

> 노드/엣지를 canvas entity에 통합. 항상 함께 로드/사용되므로 분리 불필요.

**라우팅** (`pane-routes.tsx`):

```typescript
const CanvasListPage = lazy(() => import('@pages/canvas'))
const CanvasDetailPage = lazy(() => import('@pages/canvas-detail'))
// PANE_ROUTES에 추가
```

#### 1-D. Renderer — 캔버스 리스트 페이지

**디렉토리**: `src/renderer/src/pages/canvas/`

```
ui/CanvasListPage.tsx  → TabContainer + 캔버스 목록 + 추가 버튼
index.ts               → barrel export
```

#### 1-E. Renderer — 캔버스 디테일 페이지

**디렉토리**: `src/renderer/src/pages/canvas-detail/`

```
ui/CanvasDetailPage.tsx  → TabContainer + Header (title/desc 편집) + CanvasBoard
index.ts                 → barrel export
```

#### 1-F. Renderer — 캔버스 위젯

**디렉토리**: `src/renderer/src/widgets/canvas-board/`

```
ui/CanvasBoard.tsx         → ReactFlowProvider 외부 셸 + CanvasBoardInner 내부 컴포넌트
ui/TextNodeContent.tsx     → text 커스텀 노드 (Handle 4방향 + 마크다운 편집)
ui/RefNodeContent.tsx      → ref 커스텀 노드 (todo/note/schedule/csv/pdf/image 미리보기)
ui/CustomEdge.tsx          → 커스텀 엣지 (색상, 스타일, 라벨, 화살표 — markerEnd는 props 패스스루)
ui/CanvasToolbar.tsx       → 추가 도구 모음 (노드 추가 메뉴, 레이아웃 프리셋)
model/canvas-store.ts     → Zustand store (React Flow controlled mode)
model/use-canvas-data.ts  → React Query fetch → store.hydrate() + isLoading + savedViewport + handleConnect/handleNodesDelete/handleEdgesDelete + createNodeMutation + updateViewportMutation
model/use-canvas-flush.ts → dirtyNodeIds 감지 → IPC bulkUpdatePositions
model/types.ts             → 위젯 내부 타입 (TextNodeData, RefNodeData 등 커스텀 노드 데이터)
index.ts                   → barrel export
```

**Phase 1에서 React Flow가 대체하는 것 (직접 구현 불필요):**

- ~~use-viewport.ts~~ → React Flow 내장 줌/팬
- ~~use-node-drag.ts~~ → React Flow 내장 노드 드래그
- ~~viewport-utils.ts~~ → React Flow 내장 좌표 변환
- ~~EdgeLayer.tsx~~ → React Flow 내장 SVG 엣지 레이어
- ~~use-edge-draft.ts~~ → React Flow 내장 연결선 (connection line)
- ~~edge-utils.ts~~ → React Flow `getBezierPath()` 유틸

### Phase 2: 고급 기능

> 목표: 그룹핑 + Entity Link + ref 연동 강화

**Main Process 추가:**

- `src/main/repositories/canvas-group.ts` — CRUD + findByCanvasId
- `src/main/services/canvas-group.ts` — 그룹 CRUD
- `src/main/ipc/canvas-group.ts` — canvasGroup:\* 채널

**Renderer 추가:**

- `widgets/canvas-board/ui/GroupNode.tsx` — React Flow 커스텀 노드로 그룹 구현 (리사이즈 가능 영역)

**Entity Link 통합 (수정 5개 파일):**

- `src/main/db/schema/entity-link.ts` — `LinkableEntityType`에 `'canvas'` 추가
- `src/main/services/entity-link.ts` — `findEntity()` switch에 `case 'canvas'` (canvasRepository import)
- `src/preload/index.d.ts` — `LinkableEntityType` 동기화
- `src/renderer/src/shared/lib/entity-link.ts` — label: '캔버스', icon: Workflow 추가
- `src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts` — `case 'canvas': return { type: 'canvas-detail', pathname: \`/canvas/${linkedId}\`, title }`

**캔버스 삭제 시 Entity Link 정리:**

- `canvas.ts` service의 `remove`에서 `entityLinkService.removeAllLinks('canvas', canvasId)` 호출 (entity link 삭제 → canvas 삭제 순서, note.ts:245-246 패턴)

**Feature 레이어 (신규):**

- `src/renderer/src/features/canvas/add-ref-node/` — 기존 todo/note/schedule 등을 캔버스 노드로 추가하는 다이얼로그 (검색/선택 UI + createNodeMutation)

**기능:**

- ref_id 연동 (기존 todo/note를 캔버스 노드로 추가하는 다이얼로그 — `features/canvas/add-ref-node/`)
- 엣지 클릭 선택, 더블클릭 라벨 편집, Delete키 삭제 (커스텀 엣지 확장)
- Entity Link 연결/해제

### Phase 3: 폴리싱

- 자동 레이아웃 (@dagrejs/dagre) — 프리셋 4종 + 부분 레이아웃
- 단축키 시스템 (Delete 삭제, Ctrl+A 전체 선택 등)
- 캔버스 내보내기 (이미지/JSON)

> **Undo/Redo 참고**: Command Pattern 기반. 각 액션을 Command 객체로 만들어 history stack에 push.

---

## 13. Entity Link 통합

기존 Entity Link 시스템에 canvas를 추가하여 다른 모든 도메인 요소와 link 가능하게 한다.

**수정 파일:**

| 파일                                                                      | 변경                                                                                                                                                                                                     | Phase |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `src/main/db/schema/entity-link.ts`                                       | `LinkableEntityType`에 `'canvas'` 추가, `LINKABLE_ENTITY_TYPES` 배열에 추가                                                                                                                              | 2     |
| `src/main/services/entity-link.ts`                                        | `findEntity()` switch에 `case 'canvas': return canvasRepository.findById(id)` (Canvas 타입은 `workspaceId: string` + `title: string` 보유 → 반환 타입 `{ workspaceId, title }` 구조적 호환, cast 불필요) | 2     |
| `src/preload/index.d.ts`                                                  | `LinkableEntityType` 타입에 `'canvas'` 추가                                                                                                                                                              | 2     |
| `src/renderer/src/shared/lib/entity-link.ts`                              | `ENTITY_TYPE_LABEL`에 `canvas: '캔버스'`, `ENTITY_TYPE_ICON`에 `canvas: Workflow`                                                                                                                        | 2     |
| `src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts` | `case 'canvas': return { type: 'canvas-detail', pathname: \`/canvas/${linkedId}\`, title }`                                                                                                              | 2     |

---

## 14. 수정 대상 기존 파일 종합

| 파일                                                                      | 변경 내용                                                                                 | Phase |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- |
| `src/main/db/schema/index.ts`                                             | canvases, canvasNodes, canvasEdges, canvasGroups export 추가                              | 1     |
| `src/main/index.ts`                                                       | registerCanvasHandlers(), registerCanvasNodeHandlers(), registerCanvasEdgeHandlers() 등록 | 1     |
| `src/main/repositories/todo.ts`                                           | `findByIds(ids)` 메서드 추가                                                              | 1     |
| `src/main/repositories/note.ts`                                           | `findByIds(ids)` 메서드 추가                                                              | 1     |
| `src/main/repositories/schedule.ts`                                       | `findByIds(ids)` 메서드 추가                                                              | 1     |
| `src/main/repositories/csv-file.ts`                                       | `findByIds(ids)` 메서드 추가                                                              | 1     |
| `src/main/repositories/pdf-file.ts`                                       | `findByIds(ids)` 메서드 추가                                                              | 1     |
| `src/main/repositories/image-file.ts`                                     | `findByIds(ids)` 메서드 추가                                                              | 1     |
| `src/preload/index.ts`                                                    | canvas, canvasNode, canvasEdge API bridge 구현                                            | 1     |
| `src/preload/index.d.ts`                                                  | Canvas 전체 타입 + API 인터페이스                                                         | 1     |
| `src/renderer/src/shared/constants/tab-url.ts`                            | TabType, ROUTES, TAB_ICON, sidebar_items                                                  | 1     |
| `src/renderer/src/app/layout/model/pane-routes.tsx`                       | CanvasListPage, CanvasDetailPage 라우트                                                   | 1     |
| `src/main/db/schema/entity-link.ts`                                       | LinkableEntityType에 'canvas' 추가                                                        | 2     |
| `src/main/services/entity-link.ts`                                        | findEntity() switch에 case 'canvas' 추가                                                  | 2     |
| `src/renderer/src/shared/lib/entity-link.ts`                              | ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON                                                       | 2     |
| `src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts` | case 'canvas'                                                                             | 2     |

---

## 15. 파일 수 추정

| Phase    | 신규    | 수정    | 설명                                                                   |
| -------- | ------- | ------- | ---------------------------------------------------------------------- |
| Phase 1  | ~31     | ~12     | 스키마 4 + Repo 3 + Service 3 + IPC 3 + Entity 4 + Pages 4 + Widget 10 |
| Phase 2  | ~7      | ~5      | 그룹 Repo+Service+IPC + GroupNode + Feature(add-ref-node) + ref 패널   |
| Phase 3  | ~3      | ~2      | Dagre 레이아웃, 단축키, 내보내기                                       |
| **총계** | **~41** | **~19** | (이전 v1.2: ~41 신규, ~22 수정)                                        |

> React Flow 채택으로 Phase 수 4→3으로 단축. 커스텀 렌더링 6개 파일 제거했지만, Entity/Page 구조 파일(barrel export 등)을 정확히 계산하면 v1.2 대비 미미한 차이.

---

## 16. 의존성 설치

```bash
# Phase 1에서 설치
npm install @xyflow/react

# Phase 3에서 설치
npm install @dagrejs/dagre
npm install -D @types/dagre
```

> `@xyflow/react` v12: MIT 라이선스, ~40-50KB gzipped, 주간 190만 DL.
> React Flow Pro 구독은 예제 코드와 우선 지원만 제공. 라이브러리 기능은 전부 무료.

---

## 17. 검증

```bash
npm run typecheck
npm run test
npm run dev
```

수동 검증 항목 (Phase별):

**Phase 1:**

- [ ] 사이드바에서 캔버스 페이지 열기
- [ ] 캔버스 생성/삭제
- [ ] 캔버스 디테일 페이지 열기
- [ ] title/description 수정
- [ ] 빈 공간 더블클릭으로 text 노드 생성
- [ ] 노드 드래그 이동
- [ ] 캔버스 팬 (빈 공간 드래그)
- [ ] 마우스 포인터 중심 줌 (휠)
- [ ] 뷰포트 저장/복원 (캔버스 재열기 시)
- [ ] 노드 삭제 (Delete키)
- [ ] 배경 그리드 표시
- [ ] 미니맵 표시 및 상호작용
- [ ] 줌 컨트롤 UI (Controls)
- [ ] 스냅 그리드 (20px)
- [ ] 엣지 생성 (핸들 드래그)
- [ ] 엣지 삭제 (Delete키)
- [ ] 엣지 라벨 표시
- [ ] 베지어 커브 렌더링
- [ ] 노드 삭제 시 연결 엣지 자동 삭제 (CASCADE + store 동기화)
- [ ] 탭 스냅샷 저장/복원 시 캔버스 탭 포함

**Phase 2:**

- [ ] 그룹 생성/편집/삭제
- [ ] ref_id로 기존 todo/note 노드 추가
- [ ] Entity Link 연결/해제
- [ ] Entity Link에서 캔버스 클릭 시 탭 열기
- [ ] 엣지 더블클릭 라벨 편집

**Phase 3:**

- [ ] 자동 레이아웃 (Dagre 프리셋 4종)
- [ ] Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)

---

## 18. 주의사항

- **탭 시스템**: 캔버스 리스트(`canvas`)와 디테일(`canvas-detail`)을 별도 TabType으로 관리. 디테일은 `/canvas/:canvasId` 패턴
- **Container Query**: 캔버스 리스트 페이지는 `@container` 쿼리 사용 (TabContainer 하위). 캔버스 디테일의 ReactFlow 영역은 `h-full w-full` 전체 크기 사용
- **React Flow CSS**: `@xyflow/react/dist/style.css`를 반드시 import. Tailwind와 충돌 없음
- **nodeTypes/edgeTypes 외부 정의**: React 컴포넌트 외부(모듈 레벨)에서 정의해야 불필요한 리렌더링 방지
- **Drizzle ORM**: Rally 프로젝트는 raw SQL이 아닌 Drizzle ORM 사용. integer timestamp_ms 패턴 준수
- **ID 생성**: service layer에서 `nanoid()` 사용
- **Handle ID ↔ DB side 매핑**: React Flow Handle의 `id` prop에 `'top'|'right'|'bottom'|'left'`를 사용하여 DB의 `fromSide`/`toSide`와 직접 매핑. Handle이 2개 이상인 노드에서 `id` 누락 시 `sourceHandle`/`targetHandle`이 null이 됨 (필수)
- **ConnectionMode.Loose**: 모든 Handle을 `type="source"`로 통일하고 `connectionMode={ConnectionMode.Loose}`를 사용하여 어떤 side든 자유 연결 허용
- **벌크 업데이트**: `onNodesChange`에서 `dragging: false` 감지 → **새 Set 생성**으로 dirtyNodeIds 갱신 (기존 Set mutation은 Zustand 변경 감지 불가) → useEffect에서 디바운스 후 IPC 호출
- **뷰포트 저장**: `CanvasBoardInner`에서 `onMoveEnd` 콜백 → `useRef + setTimeout` 수동 디바운스(500ms) → `updateViewportMutation` IPC 호출. 외부 디바운스 라이브러리 사용하지 않음 (기존 NoteEditor, useCsvEditor 패턴)
- **뷰포트 복원 (hydration 대기)**: `isLoading` 가드로 React Query fetch 완료 전 `<ReactFlow>` 마운트 방지. `defaultViewport`/`fitView`는 초기 렌더 시에만 적용되는 uncontrolled prop이므로, hydration 이후 마운트해야 `savedViewport`와 `nodes.length` 값이 정확. `defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 1 }}`, `fitView={nodes.length === 0}` 조합으로 빈 캔버스는 fitView, 기존 캔버스는 저장된 viewport 복원
- **엣지 좌표 미저장**: 엣지는 source/target 노드 ID와 handle(side)만 저장. React Flow가 실시간 path 계산
- **노드 삭제 시 엣지**: DB는 FK CASCADE로 자동 삭제. **React Flow controlled mode에서 노드 삭제 시 연결 엣지가 자동 제거되지 않음** → `onNodesDelete` 핸들러에서 `store.removeEdges(connectedEdgeIds)` 수동 호출 필수 (Section 7.4 참고). `onNodesChange(type: 'remove')`는 DB 삭제를 수행하지 않으므로, DB 영속화는 반드시 `onNodesDelete` 콜백에서 IPC 호출로 처리
- **캔버스 삭제 시 Entity Link**: service의 `remove()`에서 `entityLinkService.removeAllLinks('canvas', id)` 호출 필요 (link 삭제 → entity 삭제 순서)
- **유효하지 않은 ref_id**: 참조 대상이 삭제된 경우 노드를 "깨진 참조" UI로 표시. 런타임 에러 방지
- **ref 데이터 최신성**: 참조 대상(todo/note 등)이 다른 탭에서 수정되면 캔버스 store의 refTitle/refPreview가 stale. 캔버스 탭 활성화 시 **ref 데이터만 부분 refetch** (IPC로 ref batch fetch → store의 `node.data` 업데이트). 전체 hydrate를 다시 하면 dirty 노드 위치를 덮어쓰므로, **position은 건드리지 않고 data 필드만 갱신**하는 `updateRefData(refMap)` store action 사용. dirty 노드가 있으면 먼저 flush 후 refetch하는 것도 대안
- **Watcher 불필요**: 캔버스는 파일시스템 기반이 아닌 순수 DB 기반이므로 workspace-watcher 확장 불필요
- **Preload 구현 패턴**: `.d.ts`에는 강타입(CreateCanvasNodeData 등), `.ts` 구현체에서는 data 파라미터를 `unknown`으로 사용 (기존 todo/schedule 패턴과 동일)
- **캔버스 Store 에피메럴**: `dirtyNodeIds`가 `Set<string>`이므로 JSON 직렬화 불가. 캔버스 store는 탭 세션 저장 대상이 아님 (의도된 설계)
- **Service 변환 함수**: `toCanvasItem()`, `toCanvasNodeItem()`, `toCanvasEdgeItem()` 필수. DB row의 timestamp_ms → Date 변환을 방어적으로 처리 (기존 `toTodoItem()`, `toNoteNode()` 패턴: `x instanceof Date ? x : new Date(x as number)`)
- **onlyRenderVisibleElements**: 초기 마운트 시 모든 노드가 한번 렌더링됨 (React Flow 제약). `React.memo`로 커스텀 노드 래핑하여 불필요한 리렌더링 방지
- **findByIds 청킹**: 6개 repository에 추가하는 `findByIds(ids)` 메서드에서 SQLite 바인딩 변수 한도(999) 주의. `inArray()`에 전달하는 ids를 `CHUNK = 900`으로 분할해야 함 (기존 note.ts:70 패턴)
- **canvas_edges에 updatedAt 없음**: 의도적 결정 (엣지 수정 빈도 낮음). 수정 시각 추적이 필요하면 추후 추가
- **ReactFlowProvider + 컴포넌트 분리**: `useReactFlow()` 훅은 `<ReactFlowProvider>` **내부**에서만 호출 가능. `CanvasBoard`(외부 셸)가 Provider를 제공하고, `CanvasBoardInner`(내부)가 `useReactFlow()`로 `screenToFlowPosition`, `fitView` 등을 사용. 이 분리는 React Flow 공식 패턴
- **screenToFlowPosition()**: `CanvasBoardInner`의 `handleDoubleClick`에서 `event.clientX`/`clientY` → `screenToFlowPosition({ x, y })` 변환 → 캔버스 좌표로 text 노드 생성
- **devtools 미들웨어**: canvas store도 `create<CanvasStore>()(devtools((set, get) => ({...})))` 패턴 사용 (기존 useTabStore와 동일)
- **addEdge 이름 충돌**: `@xyflow/react`의 `addEdge` 유틸과 충돌 방지를 위해 store action은 `insertEdge`로 명명
- **store.updateRefData()**: ref 부분 갱신 전용 store action. `Map<refId, { title, preview }>`를 받아 node.data의 refTitle/refPreview만 업데이트하고 position은 보존. 탭 활성화 시 ref batch refetch 후 호출
- **엣지 삭제 애니메이션 주의**: React Flow controlled mode에서 `edges` 배열에서 제거하면 DOM 즉시 삭제. 애니메이션을 위해선 "deleting" 상태를 잠시 유지 → CSS class → timeout 후 실제 제거하는 패턴 필요 (Phase 2+ 폴리싱)
- **toCreateCanvasEdgeData()**: React Flow `Connection` 타입의 `source`/`target`은 `string | null`이므로 null 체크 필수
