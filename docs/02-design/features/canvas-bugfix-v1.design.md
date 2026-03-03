# Canvas 1차 구현 문제점 수정 Design

> **Feature**: canvas-bugfix-v1
> **Type**: Bug Fix + UX Enhancement
> **Plan**: [canvas-bugfix-v1.plan.md](../../01-plan/features/canvas-bugfix-v1.plan.md)
> **Created**: 2026-03-03

---

## 1. 구현 순서

```
Fix 1 → Fix 5 → Fix 6 → Fix 7 → Fix 4 → Fix 3 → Fix 2
```

---

## 2. Fix 1: 노드/엣지 추가 시 즉시 반영

### 2.1 현재 문제

```
[mutation] → invalidateQueries → dbNodes/dbEdges 갱신
                                       ↓
                              useEffect 실행
                                       ↓
                           hydratedRef.current === true → return (차단!)
                                       ↓
                              store 갱신 안됨 → UI 반영 안됨
```

### 2.2 수정 설계

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-data.ts`

**변경 전** (lines 76-83):

```ts
const hydratedRef = useRef(false)
useEffect(() => {
  if (isLoading || hydratedRef.current) return
  hydratedRef.current = true
  store.getState().setNodes(dbNodes.map(toReactFlowNode))
  store.getState().setEdges(dbEdges.map(toReactFlowEdge))
  store.getState().setHydrated(true)
}, [isLoading, dbNodes, dbEdges, store])
```

**변경 후**:

```ts
const hydratedRef = useRef(false)

// 1) Initial hydration — 최초 1회
useEffect(() => {
  if (isLoading || hydratedRef.current) return
  hydratedRef.current = true
  store.getState().setNodes(dbNodes.map(toReactFlowNode))
  store.getState().setEdges(dbEdges.map(toReactFlowEdge))
  store.getState().setHydrated(true)
}, [isLoading, dbNodes, dbEdges, store])

// 2) Sync after mutations — hydration 완료 후 DB 변경 시 store 동기화
useEffect(() => {
  if (!hydratedRef.current) return
  store.getState().setNodes(dbNodes.map(toReactFlowNode))
}, [dbNodes, store])

useEffect(() => {
  if (!hydratedRef.current) return
  store.getState().setEdges(dbEdges.map(toReactFlowEdge))
}, [dbEdges, store])
```

**핵심 원리**:

- 기존 hydration effect는 그대로 유지 (최초 1회 로딩 후 초기화)
- 별도 effect 2개 추가: `dbNodes`/`dbEdges` 변경 감지 → hydration 완료 후에만 store 갱신
- mutation → invalidateQueries → React Query refetch → `dbNodes`/`dbEdges` 변경 → store 즉시 반영

**주의사항**:

- `dbNodes`는 React Query가 반환하는 배열이므로, 데이터가 실제 변경되었을 때만 새 참조 생성
- 불필요한 리렌더 없음 (React Query의 structural sharing이 동일 데이터면 같은 참조 유지)

---

## 3. Fix 5: 엣지 연결 안정화

### 3.1 현재 문제

```
TextNode / RefNode Handle 구성:
  <Handle type="target" position={Top}    id="top" />     ← 드래그 시작 불가
  <Handle type="target" position={Left}   id="left" />    ← 드래그 시작 불가
  <Handle type="source" position={Bottom} id="bottom" />  ← 드래그 시작 가능
  <Handle type="source" position={Right}  id="right" />   ← 드래그 시작 가능

→ ConnectionMode.Loose에서도 target handle에서 연결 시작 불가
→ top/left 방향에서 엣지 생성 실패
```

### 3.2 수정 설계

**파일**: `TextNode.tsx`, `RefNode.tsx`

**변경**: 각 위치에 source + target 핸들을 겹쳐 배치

```tsx
{/* 각 위치에 source + target 핸들 겹침 배치 → 양방향 연결 가능 */}
<Handle type="source" position={Position.Top} id="top-source" className="!w-2 !h-2" />
<Handle type="target" position={Position.Top} id="top-target" className="!w-2 !h-2" />

<Handle type="source" position={Position.Right} id="right-source" className="!w-2 !h-2" />
<Handle type="target" position={Position.Right} id="right-target" className="!w-2 !h-2" />

<Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-2 !h-2" />
<Handle type="target" position={Position.Bottom} id="bottom-target" className="!w-2 !h-2" />

<Handle type="source" position={Position.Left} id="left-source" className="!w-2 !h-2" />
<Handle type="target" position={Position.Left} id="left-target" className="!w-2 !h-2" />
```

**`toCreateCanvasEdgeData` 영향 확인**:

- 기존: `sourceHandle`/`targetHandle`에 `"top"`, `"right"` 등 저장
- 변경 후: `"top-source"`, `"right-target"` 등으로 변경됨
- `converters.ts`의 `toCreateCanvasEdgeData`에서 `-source`/`-target` 접미사를 strip하여 DB 저장:

```ts
// converters.ts 수정
function parseSide(handle: string | null | undefined): 'top' | 'right' | 'bottom' | 'left' {
  const raw = (handle ?? 'right').replace(/-(?:source|target)$/, '')
  return raw as 'top' | 'right' | 'bottom' | 'left'
}

export function toCreateCanvasEdgeData(connection: {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}): CreateCanvasEdgeData {
  return {
    fromNode: connection.source,
    toNode: connection.target,
    fromSide: parseSide(connection.sourceHandle),
    toSide: parseSide(connection.targetHandle)
  }
}
```

**`toReactFlowEdge` 영향**:

- DB에서 `fromSide: "right"`, `toSide: "left"` 저장
- ReactFlow에 전달 시 handle ID에 `-source`/`-target` 접미사 추가 필요:

```ts
// converters.ts 수정
export function toReactFlowEdge(item: CanvasEdgeItem): Edge {
  return {
    id: item.id,
    source: item.fromNode,
    target: item.toNode,
    sourceHandle: `${item.fromSide}-source`,
    targetHandle: `${item.toSide}-target`,
    type: 'customEdge'
    // ... 나머지 동일
  }
}
```

---

## 4. Fix 6: 드래그 다중 선택 + Cmd 팬

### 4.1 수정 설계

**파일**: `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx`

**ReactFlow props 변경/추가**:

```tsx
<ReactFlow
  // ... 기존 props 유지
  panOnDrag={false}                   // 추가: 기본 드래그=팬 해제
  selectionOnDrag                     // 추가: 드래그=선택 박스
  panActivationKeyCode="Meta"         // 추가: Cmd+드래그=팬
  // deleteKeyCode, multiSelectionKeyCode, snapToGrid 등 유지
>
```

**동작 매핑**:

| 입력             | 동작           |
| ---------------- | -------------- |
| 드래그 (빈 영역) | 선택 박스      |
| Cmd + 드래그     | 캔버스 팬      |
| Shift + 클릭     | 다중 선택 추가 |
| 스크롤/스와이프  | 줌             |
| 핀치             | 줌             |

---

## 5. Fix 7: 선택 요소 삭제 UI + 엣지 선택 피드백

### 5.1 CustomEdge 선택 피드백

**파일**: `src/renderer/src/widgets/canvas/ui/CustomEdge.tsx`

```tsx
function CustomEdgeComponent({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  label, style, markerEnd, markerStart,
  selected,  // ← 추가: EdgeProps에 이미 포함
}: EdgeProps): React.JSX.Element {
  const { deleteElements } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({ ... })

  const edgeStyle = selected
    ? { ...style, stroke: 'hsl(var(--primary))', strokeWidth: 2.5 }
    : style

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} markerStart={markerStart} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan absolute size-5 rounded-full bg-destructive text-destructive-foreground
                       flex items-center justify-center text-xs pointer-events-auto hover:bg-destructive/90"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            onClick={() => deleteElements({ edges: [{ id }] })}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
      {!selected && label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute bg-background border rounded px-2 py-0.5 text-xs pointer-events-auto"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
```

### 5.2 SelectionToolbar 컴포넌트

**파일**: `src/renderer/src/widgets/canvas/ui/SelectionToolbar.tsx` (신규 생성)

> **[C1 수정]** `useStore`는 selector hook이므로 `.getState()` 불가.
> `useReactFlow().getNodes()`/`.getEdges()`로 명령형 접근.

```tsx
import { useCallback } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/button'

export function SelectionToolbar(): React.JSX.Element | null {
  const { deleteElements, getNodes, getEdges } = useReactFlow()

  // useStore selector로 선택 수 구독 (반응형)
  const selectedNodeCount = useStore((s) => s.nodes.filter((n) => n.selected).length)
  const selectedEdgeCount = useStore((s) => s.edges.filter((e) => e.selected).length)
  const totalSelected = selectedNodeCount + selectedEdgeCount

  const handleDelete = useCallback(() => {
    // useReactFlow의 명령형 API로 현재 선택된 요소 가져오기
    const selectedNodes = getNodes().filter((n) => n.selected)
    const selectedEdges = getEdges().filter((e) => e.selected)
    deleteElements({ nodes: selectedNodes, edges: selectedEdges })
  }, [deleteElements, getNodes, getEdges])

  if (totalSelected === 0) return null

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10
                    flex items-center gap-2 bg-background/90 backdrop-blur border
                    rounded-lg shadow-sm px-3 py-1.5"
    >
      <span className="text-sm text-muted-foreground">{totalSelected}개 선택됨</span>
      <Button variant="destructive" size="sm" className="h-7 px-2" onClick={handleDelete}>
        <Trash2 className="size-3.5 mr-1" />
        삭제
      </Button>
    </div>
  )
}
```

**CanvasBoard에서 사용**:

```tsx
import { SelectionToolbar } from './SelectionToolbar'

// ReactFlowProvider 내부, ReactFlow 아래에 배치
;<SelectionToolbar />
```

**주의**: `SelectionToolbar`는 `ReactFlowProvider` 내부에 있어야 `useReactFlow()`/`useStore()` 사용 가능.

---

## 6. Fix 4: 노드 크기 조절

### 6.1 NodeResizer 적용

**파일**: `TextNode.tsx`, `RefNode.tsx`

> **[W3 수정]** RefNode 외부 div에 `overflow-hidden`이 있으면 NodeResizer 핸들이 클리핑됨.
> 해결: NodeResizer를 외부 div **밖**에 배치 (Fragment 래퍼 사용).

**TextNode** — 외부 div에 overflow-hidden 없음 → div 내부 첫 자식으로 배치 가능:

```tsx
import { NodeResizer } from '@xyflow/react'
;<div className="rounded-lg border ...">
  <NodeResizer
    minWidth={160}
    minHeight={80}
    isVisible={selected}
    lineClassName="!border-primary"
    handleClassName="!size-2 !bg-primary !border-primary"
  />
  {/* Handle, content ... */}
</div>
```

**RefNode** — 외부 div에 `overflow-hidden` 있음 → Fragment 사용:

```tsx
import { NodeResizer } from '@xyflow/react'

return (
  <>
    <NodeResizer
      minWidth={160}
      minHeight={80}
      isVisible={selected}
      lineClassName="!border-primary"
      handleClassName="!size-2 !bg-primary !border-primary"
    />
    <div className="rounded-lg border ... overflow-hidden h-full flex flex-col ...">
      {/* Handle, header, content ... */}
    </div>
  </>
)
```

### 6.2 리사이즈 DB 저장

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-data.ts`

`onNodesChange`에 `dimensions` 타입 처리 추가:

```ts
const onNodesChange: OnNodesChange = useCallback(
  (changes) => {
    store.getState().applyNodeChanges(changes)

    // ... 기존 position/remove 핸들링 유지

    // Handle resize (dimensions change)
    // [C2 수정] resizing은 boolean | undefined이므로 === false 대신 !c.resizing 사용
    const dimensionChanges = changes.filter(
      (c) =>
        c.type === 'dimensions' &&
        'resizing' in c &&
        !c.resizing &&
        'dimensions' in c &&
        !!c.dimensions
    )
    for (const c of dimensionChanges) {
      const dims = (c as { dimensions: { width: number; height: number } }).dimensions
      updateNode({
        nodeId: c.id,
        data: { width: dims.width, height: dims.height },
        canvasId
      })
    }
  },
  [canvasId, updatePositions, removeNode, updateNode, store]
)
```

**UpdateCanvasNodeData** 확인: `width?: number, height?: number` 이미 정의됨 → 백엔드 변경 불필요.

---

## 7. Fix 3: RefNode 컨텐츠 표시 개선

### 7.1 수정 설계

**파일**: `src/renderer/src/widgets/canvas/ui/RefNode.tsx`

**변경 전**:

```tsx
<div className="p-3 flex-1 overflow-hidden">
  <p className="text-sm font-medium truncate">{nodeData.refTitle || '(제목 없음)'}</p>
  {nodeData.refPreview && (
    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{nodeData.refPreview}</p>
  )}
</div>
```

**변경 후**:

```tsx
<div className="p-3 flex-1 overflow-y-auto nowheel">
  <p className="text-sm font-medium truncate">{nodeData.refTitle || '(제목 없음)'}</p>
  {nodeData.refPreview && (
    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{nodeData.refPreview}</p>
  )}
</div>
```

**변경 사항**:

- `overflow-hidden` → `overflow-y-auto` — 컨텐츠 넘침 시 스크롤 가능
- `nowheel` 클래스 추가 — 스크롤 시 캔버스 줌 방지 (ReactFlow convention)
- `line-clamp-3` 제거, `whitespace-pre-wrap` 추가 — 전체 컨텐츠 표시

---

## 8. Fix 2: 노드 겹침 회피

### 8.1 수정 설계

**파일**: `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx`

겹침 감지 유틸 함수 추가 (CanvasBoard 내부):

```ts
const findNonOverlappingPosition = useCallback(
  (baseX: number, baseY: number, width = 260, height = 160): { x: number; y: number } => {
    const currentNodes = useCanvasFlowStore.getState().nodes
    let x = baseX
    let y = baseY
    const OFFSET = 30

    const isOverlapping = (cx: number, cy: number) =>
      currentNodes.some(
        (n) =>
          Math.abs(n.position.x - cx) < width * 0.5 && Math.abs(n.position.y - cy) < height * 0.5
      )

    // [W4 수정] 무한 루프 방지: 최대 20회 시도
    let attempts = 0
    while (isOverlapping(x, y) && attempts < 20) {
      x += OFFSET
      y += OFFSET
      attempts++
    }

    return { x, y }
  },
  []
)
```

**`handleAddText` / `handleEntitySelect` 수정**:

```ts
const handleAddText = useCallback(() => {
  const center = getViewportCenter()
  const { x, y } = findNonOverlappingPosition(center.x - 130, center.y - 80)
  addTextNode(x, y)
}, [getViewportCenter, findNonOverlappingPosition, addTextNode])

const handleEntitySelect = useCallback(
  (type: CanvasNodeType, refId: string) => {
    const center = getViewportCenter()
    const { x, y } = findNonOverlappingPosition(center.x - 130, center.y - 80)
    addRefNode(type, refId, x, y)
  },
  [getViewportCenter, findNonOverlappingPosition, addRefNode]
)
```

---

## 9. 파일별 수정 요약

| 파일                                      | Fix     | 수정 유형                                                                          |
| ----------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `widgets/canvas/model/use-canvas-data.ts` | 1, 4    | dbNodes/dbEdges sync effect 추가, dimensions 핸들링                                |
| `widgets/canvas/ui/CanvasBoard.tsx`       | 2, 6    | panOnDrag/selectionOnDrag props, findNonOverlappingPosition, SelectionToolbar 배치 |
| `widgets/canvas/ui/TextNode.tsx`          | 4, 5    | NodeResizer 추가, Handle 양방향 겹침 배치                                          |
| `widgets/canvas/ui/RefNode.tsx`           | 3, 4, 5 | 스크롤 컨텐츠, NodeResizer, Handle 양방향 겹침 배치                                |
| `widgets/canvas/ui/CustomEdge.tsx`        | 7       | selected 스타일 + 삭제 버튼                                                        |
| `widgets/canvas/ui/SelectionToolbar.tsx`  | 7       | 신규 생성 — 선택 요소 삭제 플로팅 바                                               |
| `entities/canvas/model/converters.ts`     | 5       | parseSide 헬퍼, sourceHandle/targetHandle 접미사 처리                              |

---

## 10. 새 패키지 / DB 변경

- **새 패키지**: 없음 (`NodeResizer`, `useStore`, `useReactFlow` 모두 `@xyflow/react` 내장)
- **DB 스키마 변경**: 없음
- **IPC 변경**: 없음
- **Preload 변경**: 없음

---

## 11. 기존 데이터 호환성

| 항목                | 호환성                                                                               |
| ------------------- | ------------------------------------------------------------------------------------ |
| 기존 노드 위치/크기 | 유지 (width/height는 이미 DB에 저장)                                                 |
| 기존 엣지           | Handle ID 변경 (`"right"` → `"right-source"`) 필요 — `toReactFlowEdge`에서 변환 처리 |
| 기존 엣지 DB 데이터 | `fromSide`/`toSide`는 `"right"`, `"left"` 등 그대로 → converters에서 양방향 변환     |
