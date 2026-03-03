# Canvas 구조 리팩토링 Design (v4)

> **Feature**: canvas-refactor-v4
> **Type**: Refactoring (Architecture)
> **Plan**: [canvas-refactor-v4.plan.md](../../01-plan/features/canvas-refactor-v4.plan.md)
> **Created**: 2026-03-03

---

## 1. 구현 순서

```
Phase 2 (타입 안전성) → Phase 3 (레지스트리 통합) → Phase 1 (Hook 분해)
    → Phase 4 (CanvasBoard Outer/Inner) → Phase 5 (EntityPicker 중복 제거)
    → Phase 6 (테스트)
```

각 Phase 완료 후 `npm run typecheck` 통과 필수.

---

## 2. Phase 2: 타입 안전성 강화

### 2.1 ReactFlow 제네릭 타입 정의

**파일**: `src/renderer/src/entities/canvas/model/types.ts`

**추가**:

```ts
import type { Node, Edge } from '@xyflow/react'

// ─── ReactFlow Node Data Types ──────────────────────────

export type TextNodeData = {
  canvasId: string
  nodeType: 'text'
  content: string | null
  color: string | null
  label: string
  width: number
  height: number
}

export type RefNodeData = {
  canvasId: string
  nodeType: CanvasNodeType
  refId: string | null
  refTitle?: string
  refPreview?: string
  refMeta?: Record<string, unknown>
  content: string | null
  color: string | null
  label: string
  width: number
  height: number
}

// ─── ReactFlow Edge Data Types ──────────────────────────

export type CanvasEdgeData = {
  edgeStyle: CanvasEdgeStyle
  arrow: CanvasEdgeArrow
  color: string | null
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
}

// ─── Discriminated Union Types ──────────────────────────

export type TextNode = Node<TextNodeData, 'textNode'>
export type RefNode = Node<RefNodeData, 'refNode'>
export type CanvasNode = TextNode | RefNode
export type CanvasEdge = Edge<CanvasEdgeData>
```

> `TextNodeData`와 `RefNodeData`의 필드는 현재 `converters.ts`의 `toReactFlowNode()` data 객체와 정확히 일치해야 함. `label`, `width`, `height` 포함.

**기존 타입은 모두 유지** — `CanvasNodeItem`, `CanvasEdgeItem`, `Create*Data`, `Update*Data` 등은 DB 레이어 타입으로 별개.

### 2.2 converters.ts 반환 타입 변경

**파일**: `src/renderer/src/entities/canvas/model/converters.ts`

**변경 전**:

```ts
import type { Node, Edge } from '@xyflow/react'

export function toReactFlowNode(item: CanvasNodeItem): Node {
export function toReactFlowEdge(item: CanvasEdgeItem): Edge {
```

**변경 후**:

```ts
import type { Node, Edge } from '@xyflow/react'
import type { TextNodeData, RefNodeData, CanvasEdgeData, CanvasNode, CanvasEdge } from './types'

export function toReactFlowNode(item: CanvasNodeItem): CanvasNode {
  if (item.type === 'text') {
    return {
      id: item.id,
      type: 'textNode' as const,
      position: { x: item.x, y: item.y },
      data: {
        label: item.content ?? '',
        canvasId: item.canvasId,
        content: item.content,
        nodeType: 'text' as const,
        color: item.color,
        width: item.width,
        height: item.height
      },
      style: { width: item.width, height: item.height },
      zIndex: item.zIndex
    }
  }

  return {
    id: item.id,
    type: 'refNode' as const,
    position: { x: item.x, y: item.y },
    data: {
      label: item.refTitle ?? item.content ?? '',
      canvasId: item.canvasId,
      content: item.content,
      refId: item.refId,
      refTitle: item.refTitle,
      refPreview: item.refPreview,
      nodeType: item.type,
      color: item.color,
      width: item.width,
      height: item.height,
      refMeta: item.refMeta
    },
    style: { width: item.width, height: item.height },
    zIndex: item.zIndex
  }
}

export function toReactFlowEdge(item: CanvasEdgeItem): CanvasEdge {
  return {
    id: item.id,
    source: item.fromNode,
    target: item.toNode,
    sourceHandle: item.fromSide,
    targetHandle: item.toSide,
    type: 'customEdge',
    label: item.label ?? undefined,
    style: {
      strokeDasharray:
        item.style === 'dashed' ? '5 5' : item.style === 'dotted' ? '2 2' : undefined,
      stroke: item.color ?? undefined
    },
    markerEnd:
      item.arrow === 'none' ? undefined : { type: 'arrowclosed' as const, width: 28, height: 28 },
    markerStart:
      item.arrow === 'both' ? { type: 'arrowclosed' as const, width: 28, height: 28 } : undefined,
    data: {
      edgeStyle: item.style,
      arrow: item.arrow,
      color: item.color,
      fromSide: item.fromSide,
      toSide: item.toSide
    }
  }
}
```

> `toReactFlowNode`은 `item.type === 'text'`로 분기하여 TypeScript가 discriminated union을 추론할 수 있게 한다. 기존 단일 return 대신 if/return 2개.

**기존 함수 보존**: `toPositionUpdate`, `toCreateCanvasEdgeData`는 현행 유지.

**`parseSide` export 변경**: 테스트 가능하도록 export 추가.

```ts
// 변경 전
function parseSide(handle: string | null | undefined): 'top' | 'right' | 'bottom' | 'left' {

// 변경 후
export function parseSide(handle: string | null | undefined): 'top' | 'right' | 'bottom' | 'left' {
```

### 2.3 TextNode.tsx — 타입 단언 제거

**파일**: `src/renderer/src/widgets/canvas/ui/TextNode.tsx`

**변경 전**:

```ts
import { type NodeProps } from '@xyflow/react'

interface TextNodeData {
  canvasId: string
  content?: string | null
  color?: string | null
  nodeType: string
  [key: string]: unknown
}

function TextNodeComponent({ id, data, selected }: NodeProps): React.JSX.Element {
  const nodeData = data as unknown as TextNodeData
```

**변경 후**:

```ts
import { type NodeProps } from '@xyflow/react'
import type { TextNode as TextNodeType } from '@entities/canvas'

function TextNodeComponent({ id, data, selected }: NodeProps<TextNodeType>): React.JSX.Element {
  // data 직접 사용 — 타입 단언 불필요
  const { mutate: updateNode } = useUpdateCanvasNode()
  const [editing, setEditing] = useState(false)
  const [localContent, setLocalContent] = useState(data.content ?? '')
```

- `TextNodeData` 로컬 인터페이스 삭제
- `[key: string]: unknown` 인덱스 시그니처 제거
- `data as unknown as TextNodeData` → `data` 직접 접근

### 2.4 RefNode.tsx — 타입 단언 제거

**파일**: `src/renderer/src/widgets/canvas/ui/RefNode.tsx`

**변경 전**:

```ts
interface RefNodeData {
  nodeType: string
  refId?: string | null
  // ...
  [key: string]: unknown
}

function RefNodeComponent({ data, selected, dragging }: NodeProps): React.JSX.Element {
  // ...
  const nodeData = data as unknown as RefNodeData
```

**변경 후**:

```ts
import type { RefNode as RefNodeType } from '@entities/canvas'

function RefNodeComponent({ data, selected, dragging }: NodeProps<RefNodeType>): React.JSX.Element {
  // data 직접 사용
  const config = REF_NODE_REGISTRY[data.nodeType]
  const Icon = config?.icon ?? FileText
  const label = config?.label ?? data.nodeType
```

- `RefNodeData` 로컬 인터페이스 삭제
- `as unknown as` 제거
- 모든 `nodeData.xxx` → `data.xxx` 변경

### 2.5 entities/canvas/index.ts 배럴 export 추가

기존 export에 추가:

```ts
export type { TextNode, RefNode, CanvasNode, CanvasEdge, CanvasEdgeData } from './model/types'
export { parseSide } from './model/converters'
```

---

## 3. Phase 3: 프론트엔드 레지스트리 통합

### 3.1 node-type-registry.ts (기존 ref-node-registry.ts 확장)

**파일**: `src/renderer/src/widgets/canvas/model/node-type-registry.ts` (이름 변경)

**변경 전** (`ref-node-registry.ts`):

```ts
import type { NodeTypeConfig } from './node-content-registry'

export const REF_NODE_REGISTRY: Record<string, NodeTypeConfig> = {
  todo: { component: TodoNodeContent, icon: Check, label: '할 일', ... },
  // ... 6 entries
}
```

**변경 후**:

```ts
import { Type, Check, FileText, Calendar, Sheet, ImageIcon } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { TodoNodeContent } from '../ui/node-content/TodoNodeContent'
import { NoteNodeContent } from '../ui/node-content/NoteNodeContent'
import { ScheduleNodeContent } from '../ui/node-content/ScheduleNodeContent'
import { CsvNodeContent } from '../ui/node-content/CsvNodeContent'
import { PdfNodeContent } from '../ui/node-content/PdfNodeContent'
import { ImageNodeContent } from '../ui/node-content/ImageNodeContent'
import type { NodeContentProps } from './node-content-registry'
import type { CanvasNodeType } from '@entities/canvas'

export interface NodeTypeConfig {
  component: React.ComponentType<NodeContentProps> | null
  icon: React.ElementType
  label: string
  defaultWidth: number
  defaultHeight: number
  resizable: boolean
  pickable: boolean
}

export const NODE_TYPE_REGISTRY: Record<CanvasNodeType, NodeTypeConfig> = {
  text: {
    component: null,
    icon: Type,
    label: '텍스트',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: true,
    pickable: false
  },
  todo: {
    component: TodoNodeContent,
    icon: Check,
    label: '할 일',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: true,
    pickable: true
  },
  note: {
    component: NoteNodeContent,
    icon: FileText,
    label: '노트',
    defaultWidth: 300,
    defaultHeight: 240,
    resizable: true,
    pickable: true
  },
  schedule: {
    component: ScheduleNodeContent,
    icon: Calendar,
    label: '일정',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: false,
    pickable: true
  },
  csv: {
    component: CsvNodeContent,
    icon: Sheet,
    label: 'CSV',
    defaultWidth: 360,
    defaultHeight: 280,
    resizable: true,
    pickable: true
  },
  pdf: {
    component: PdfNodeContent,
    icon: PdfIcon,
    label: 'PDF',
    defaultWidth: 280,
    defaultHeight: 360,
    resizable: true,
    pickable: true
  },
  image: {
    component: ImageNodeContent,
    icon: ImageIcon,
    label: '이미지',
    defaultWidth: 300,
    defaultHeight: 260,
    resizable: true,
    pickable: true
  }
}

export const PICKABLE_TYPES = Object.entries(NODE_TYPE_REGISTRY)
  .filter(([, config]) => config.pickable)
  .map(([type, config]) => ({
    type: type as CanvasNodeType,
    icon: config.icon,
    label: config.label
  }))
```

**핵심 변경점**:

- `Record<string, ...>` → `Record<CanvasNodeType, ...>` 키 타입 강화
- `text` 엔트리 추가 (`component: null`, `pickable: false`)
- `pickable` 필드 추가
- `PICKABLE_TYPES` 파생 상수 export
- `NodeTypeConfig` 인터페이스를 이 파일로 이동 (component가 `null` 가능하도록 수정)

### 3.2 node-content-registry.ts 수정

**파일**: `src/renderer/src/widgets/canvas/model/node-content-registry.ts`

`NodeTypeConfig` 인터페이스가 `node-type-registry.ts`로 이동했으므로, 이 파일은 `NodeContentProps`만 export:

```ts
export interface NodeContentProps {
  refId?: string | null
  refTitle?: string
  refPreview?: string
  refMeta?: Record<string, unknown>
}
```

### 3.3 RefNode.tsx — 레지스트리 import 변경

```ts
// 변경 전
import { REF_NODE_REGISTRY } from '../model/ref-node-registry'

// 변경 후
import { NODE_TYPE_REGISTRY } from '../model/node-type-registry'
```

모든 `REF_NODE_REGISTRY[...]` → `NODE_TYPE_REGISTRY[...]` 변경.

### 3.4 ref-node-registry.ts 삭제

`node-type-registry.ts`로 완전 대체 후 삭제.

---

## 4. Phase 1: Hook 분해

### 4.1 `use-canvas-store.ts` — Store 관리

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-store.ts` (신규)

```ts
import { useMemo, useEffect, useRef } from 'react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { CanvasNode, CanvasEdge } from '@entities/canvas'

// ─── Store Interface ────────────────────────────────────

export interface CanvasFlowState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  hydrated: boolean
  setNodes: (nodes: CanvasNode[]) => void
  setEdges: (edges: CanvasEdge[]) => void
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  setHydrated: (v: boolean) => void
  reset: () => void
}

// ─── Per-canvas Store Map ───────────────────────────────

const storeMap = new Map<string, StoreApi<CanvasFlowState>>()

function getOrCreateStore(canvasId: string): StoreApi<CanvasFlowState> {
  let store = storeMap.get(canvasId)
  if (!store) {
    store = createStore<CanvasFlowState>((set) => ({
      nodes: [],
      edges: [],
      hydrated: false,
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      applyNodeChanges: (changes) =>
        set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as CanvasNode[] })),
      applyEdgeChanges: (changes) =>
        set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as CanvasEdge[] })),
      setHydrated: (hydrated) => set({ hydrated }),
      reset: () => set({ nodes: [], edges: [], hydrated: false })
    }))
    storeMap.set(canvasId, store)
  }
  return store
}

// ─── Hook ───────────────────────────────────────────────

export function useCanvasStore(canvasId: string) {
  const store = useMemo(() => getOrCreateStore(canvasId), [canvasId])
  const nodes = useStore(store, (s) => s.nodes)
  const edges = useStore(store, (s) => s.edges)
  const hydrated = useStore(store, (s) => s.hydrated)

  const hydratedRef = useRef(false)

  // Cleanup on unmount (단일 cleanup 원칙)
  useEffect(() => {
    return () => {
      store.getState().reset()
      storeMap.delete(canvasId)
      hydratedRef.current = false
    }
  }, [store, canvasId])

  return { store, nodes, edges, hydrated, hydratedRef }
}
```

**설계 근거**:

- `CanvasFlowState.nodes`/`edges`의 타입을 `Node[]`/`Edge[]`에서 `CanvasNode[]`/`CanvasEdge[]`로 강화 (Phase 2와 연계)
- `applyNodeChanges`/`applyEdgeChanges` 결과를 `as CanvasNode[]`/`as CanvasEdge[]`로 캐스트 — `applyNodeChanges`는 입력 타입을 보존하나 반환 타입이 `Node[]`이므로 필요
- `hydratedRef`를 이 hook에서 관리 — hydration hook에 전달
- cleanup은 **이 hook 하나에 통합** (Plan 필수 규칙 #2)

### 4.2 `use-canvas-hydration.ts` — DB↔Store 동기화

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-hydration.ts` (신규)

```ts
import { useEffect, type MutableRefObject } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { useCanvasNodes, useCanvasEdges, toReactFlowNode, toReactFlowEdge } from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasHydration(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  hydratedRef: MutableRefObject<boolean>
) {
  const { data: dbNodes = [], isLoading: nodesLoading } = useCanvasNodes(canvasId)
  const { data: dbEdges = [], isLoading: edgesLoading } = useCanvasEdges(canvasId)

  const isLoading = nodesLoading || edgesLoading

  // 1) Initial hydration — 최초 1회
  useEffect(() => {
    if (isLoading || hydratedRef.current) return
    hydratedRef.current = true
    store.getState().setNodes(dbNodes.map(toReactFlowNode))
    store.getState().setEdges(dbEdges.map(toReactFlowEdge))
    store.getState().setHydrated(true)
  }, [isLoading, dbNodes, dbEdges, store, hydratedRef])

  // 2) Node sync — mutation 후 ID 집합 비교로 추가/삭제만 반영
  useEffect(() => {
    if (!hydratedRef.current) return
    const storeIds = new Set(store.getState().nodes.map((n) => n.id))
    const dbIds = new Set(dbNodes.map((n) => n.id))
    if (storeIds.size !== dbIds.size || dbNodes.some((n) => !storeIds.has(n.id))) {
      store.getState().setNodes(dbNodes.map(toReactFlowNode))
    }
  }, [dbNodes, store, hydratedRef])

  // 3) Edge sync — 동일 전략
  useEffect(() => {
    if (!hydratedRef.current) return
    const storeIds = new Set(store.getState().edges.map((e) => e.id))
    const dbIds = new Set(dbEdges.map((e) => e.id))
    if (storeIds.size !== dbIds.size || dbEdges.some((e) => !storeIds.has(e.id))) {
      store.getState().setEdges(dbEdges.map(toReactFlowEdge))
    }
  }, [dbEdges, store, hydratedRef])

  return { isLoading }
}
```

**설계 근거**:

- `hydratedRef`를 매개변수로 받음 — store hook이 소유, hydration hook이 사용
- 3개 useEffect 순서 = 초기 hydration → node sync → edge sync (React 18 선언 순서 보장)
- position/size/content 변경은 store에 이미 반영되어 있으므로 ID 비교만 수행 (selected 등 UI 상태 보존)

### 4.3 `use-canvas-node-changes.ts` — Node 변경 핸들링

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-node-changes.ts` (신규)

```ts
import { useCallback } from 'react'
import type { OnNodesChange, NodeChange } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useUpdateCanvasNode,
  useUpdateCanvasNodePositions,
  useRemoveCanvasNode
} from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasNodeChanges(canvasId: string, store: StoreApi<CanvasFlowState>) {
  const { mutate: updateNode } = useUpdateCanvasNode()
  const { mutate: updatePositions } = useUpdateCanvasNodePositions()
  const { mutate: removeNode } = useRemoveCanvasNode()

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      store.getState().applyNodeChanges(changes)

      // Persist position changes on drag end
      const positionChanges = changes.filter(
        (
          c
        ): c is NodeChange & {
          type: 'position'
          dragging: false
          position: { x: number; y: number }
        } =>
          c.type === 'position' && 'dragging' in c && !c.dragging && 'position' in c && !!c.position
      )
      if (positionChanges.length > 0) {
        updatePositions({
          updates: positionChanges.map((c) => ({
            id: c.id,
            x: c.position.x,
            y: c.position.y
          })),
          canvasId
        })
      }

      // Handle resize (dimensions change)
      for (const c of changes) {
        if (
          c.type === 'dimensions' &&
          'resizing' in c &&
          !c.resizing &&
          'dimensions' in c &&
          c.dimensions
        ) {
          updateNode({
            nodeId: c.id,
            data: { width: c.dimensions.width, height: c.dimensions.height },
            canvasId
          })
        }
      }

      // Handle removals
      const removeChanges = changes.filter((c) => c.type === 'remove')
      for (const c of removeChanges) {
        removeNode({ nodeId: c.id, canvasId })
      }
    },
    [canvasId, updatePositions, removeNode, updateNode, store]
  )

  return { onNodesChange }
}
```

### 4.4 `use-canvas-edge-changes.ts` — Edge 변경 핸들링

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-edge-changes.ts` (신규)

```ts
import { useCallback } from 'react'
import type { OnEdgesChange, OnConnect } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import { useCreateCanvasEdge, useRemoveCanvasEdge, toCreateCanvasEdgeData } from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasEdgeChanges(canvasId: string, store: StoreApi<CanvasFlowState>) {
  const { mutate: createEdge } = useCreateCanvasEdge()
  const { mutate: removeEdge } = useRemoveCanvasEdge()

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      store.getState().applyEdgeChanges(changes)

      const removeChanges = changes.filter((c) => c.type === 'remove')
      for (const c of removeChanges) {
        removeEdge({ edgeId: c.id, canvasId })
      }
    },
    [canvasId, removeEdge, store]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return
      createEdge({
        canvasId,
        data: toCreateCanvasEdgeData(connection)
      })
    },
    [canvasId, createEdge]
  )

  return { onEdgesChange, onConnect }
}
```

### 4.5 `use-canvas-data.ts` — Facade Hook

**파일**: `src/renderer/src/widgets/canvas/model/use-canvas-data.ts` (전면 재작성)

```ts
import { useMemo, useCallback } from 'react'
import {
  useCanvasById,
  useCreateCanvasNode,
  useUpdateCanvasNode,
  useUpdateCanvasEdge,
  useUpdateCanvasViewport,
  type CanvasNodeItem
} from '@entities/canvas'
import { NODE_TYPE_REGISTRY } from './node-type-registry'
import { useCanvasStore } from './use-canvas-store'
import { useCanvasHydration } from './use-canvas-hydration'
import { useCanvasNodeChanges } from './use-canvas-node-changes'
import { useCanvasEdgeChanges } from './use-canvas-edge-changes'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useCanvasData(canvasId: string) {
  // Sub-hooks (호출 순서 고정 — effect 실행 순서 보장)
  const { store, nodes, edges, hydrated, hydratedRef } = useCanvasStore(canvasId)
  const { isLoading } = useCanvasHydration(canvasId, store, hydratedRef)
  const { onNodesChange } = useCanvasNodeChanges(canvasId, store)
  const { onEdgesChange, onConnect } = useCanvasEdgeChanges(canvasId, store)

  // Viewport (DB 기반 — ReactFlow 불필요)
  const { data: canvas } = useCanvasById(canvasId)
  const defaultViewport = useMemo(
    () => ({
      x: canvas?.viewportX ?? 0,
      y: canvas?.viewportY ?? 0,
      zoom: canvas?.viewportZoom ?? 1
    }),
    [canvas?.viewportX, canvas?.viewportY, canvas?.viewportZoom]
  )

  // Mutations (좌표를 매개변수로 받아 ReactFlow 불필요)
  const { mutate: updateViewport } = useUpdateCanvasViewport()
  const { mutate: createNode } = useCreateCanvasNode()
  const { mutate: updateNode } = useUpdateCanvasNode()
  const { mutate: updateEdge } = useUpdateCanvasEdge()

  const saveViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      updateViewport({ canvasId, viewport })
    },
    [canvasId, updateViewport]
  )

  const addTextNode = useCallback(
    (x: number, y: number) => {
      createNode({
        canvasId,
        data: { type: 'text', x, y, width: 260, height: 160 }
      })
    },
    [canvasId, createNode]
  )

  const addRefNode = useCallback(
    (type: CanvasNodeItem['type'], refId: string, x: number, y: number) => {
      const config = NODE_TYPE_REGISTRY[type]
      createNode({
        canvasId,
        data: {
          type,
          refId,
          x,
          y,
          width: config?.defaultWidth ?? 260,
          height: config?.defaultHeight ?? 160
        }
      })
    },
    [canvasId, createNode]
  )

  return {
    nodes,
    edges,
    isLoading,
    hydrated,
    defaultViewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    saveViewport,
    addTextNode,
    addRefNode,
    createNode,
    updateNode,
    updateEdge,
    store
  }
}
```

**설계 근거**:

- Sub-hook 호출 순서 고정: store → hydration → nodeChanges → edgeChanges
- `REF_NODE_REGISTRY` → `NODE_TYPE_REGISTRY` 변경 (Phase 3 연계)
- 반환 인터페이스는 현재와 **100% 동일** — 호출하는 쪽(CanvasBoard)에 영향 없음
- `useCanvasById`가 facade에서 직접 호출 — canvas 데이터(viewport 등)는 facade의 관심사

---

## 5. Phase 4: CanvasBoard Outer/Inner 분리

### 5.1 `canvas-layout.ts` — 순수 유틸리티

**파일**: `src/renderer/src/widgets/canvas/model/canvas-layout.ts` (신규)

```ts
import type { Node } from '@xyflow/react'

const OVERLAP_OFFSET = 30
const MAX_ATTEMPTS = 20

export function findNonOverlappingPosition(
  nodes: Node[],
  baseX: number,
  baseY: number,
  width = 260,
  height = 160
): { x: number; y: number } {
  let x = baseX
  let y = baseY

  const isOverlapping = (cx: number, cy: number): boolean =>
    nodes.some(
      (n) => Math.abs(n.position.x - cx) < width * 0.5 && Math.abs(n.position.y - cy) < height * 0.5
    )

  let attempts = 0
  while (isOverlapping(x, y) && attempts < MAX_ATTEMPTS) {
    x += OVERLAP_OFFSET
    y += OVERLAP_OFFSET
    attempts++
  }

  return { x, y }
}
```

### 5.2 `CanvasBoard.tsx` — Outer 컴포넌트

**파일**: `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx` (전면 재작성)

```ts
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasData } from '../model/use-canvas-data'
import { CanvasBoardInner } from './CanvasBoardInner'

interface CanvasBoardProps {
  canvasId: string
}

export function CanvasBoard({ canvasId }: CanvasBoardProps): React.JSX.Element {
  const canvasData = useCanvasData(canvasId)

  const isReady = !canvasData.isLoading && canvasData.hydrated

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin size-6 border-2 border-muted-foreground border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm">캔버스 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <CanvasBoardInner
        canvasId={canvasId}
        nodes={canvasData.nodes}
        edges={canvasData.edges}
        defaultViewport={canvasData.defaultViewport}
        onNodesChange={canvasData.onNodesChange}
        onEdgesChange={canvasData.onEdgesChange}
        onConnect={canvasData.onConnect}
        saveViewport={canvasData.saveViewport}
        addTextNode={canvasData.addTextNode}
        addRefNode={canvasData.addRefNode}
      />
    </ReactFlowProvider>
  )
}
```

### 5.3 `CanvasBoardInner.tsx` — Inner 컴포넌트

**파일**: `src/renderer/src/widgets/canvas/ui/CanvasBoardInner.tsx` (신규)

```ts
import { useState, useMemo, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow
} from '@xyflow/react'
import { TextNode } from './TextNode'
import { RefNode } from './RefNode'
import { CustomEdge } from './CustomEdge'
import { CanvasToolbar } from './CanvasToolbar'
import { EntityPickerDialog } from './EntityPickerDialog'
import { SelectionToolbar } from './SelectionToolbar'
import { NODE_TYPE_REGISTRY } from '../model/node-type-registry'
import { findNonOverlappingPosition } from '../model/canvas-layout'
import type { CanvasNodeType, CanvasNode, CanvasEdge } from '@entities/canvas'
import type { OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react'

const NODE_TYPES = { textNode: TextNode, refNode: RefNode }
const EDGE_TYPES = { customEdge: CustomEdge }

interface CanvasBoardInnerProps {
  canvasId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  defaultViewport: { x: number; y: number; zoom: number }
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  saveViewport: (viewport: { x: number; y: number; zoom: number }) => void
  addTextNode: (x: number, y: number) => void
  addRefNode: (type: CanvasNodeType, refId: string, x: number, y: number) => void
}

export function CanvasBoardInner({
  canvasId,
  nodes,
  edges,
  defaultViewport,
  onNodesChange,
  onEdgesChange,
  onConnect,
  saveViewport,
  addTextNode,
  addRefNode
}: CanvasBoardInnerProps): React.JSX.Element {
  const reactFlow = useReactFlow()
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [entityPickerOpen, setEntityPickerOpen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)

  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const edgeTypes = useMemo(() => EDGE_TYPES, [])

  // ─── Viewport (ReactFlow 의존) ────────────────────────

  const handleMoveEnd = useCallback(() => {
    const viewport = reactFlow.getViewport()
    clearTimeout(viewportTimerRef.current)
    viewportTimerRef.current = setTimeout(() => {
      saveViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom })
    }, 500)
  }, [reactFlow, saveViewport])

  // ─── Node 오케스트레이션 (ReactFlow 의존) ─────────────

  const getViewportCenter = useCallback((): { x: number; y: number } => {
    const container = document.querySelector('.react-flow')
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    return reactFlow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    })
  }, [reactFlow])

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!(event.target as HTMLElement).classList.contains('react-flow__pane')) return
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      addTextNode(position.x, position.y)
    },
    [reactFlow, addTextNode]
  )

  const handleAddText = useCallback(() => {
    const center = getViewportCenter()
    const { x, y } = findNonOverlappingPosition(nodes, center.x - 130, center.y - 80)
    addTextNode(x, y)
  }, [getViewportCenter, nodes, addTextNode])

  const handleEntitySelect = useCallback(
    (type: CanvasNodeType, refId: string) => {
      const center = getViewportCenter()
      const config = NODE_TYPE_REGISTRY[type]
      const w = config?.defaultWidth ?? 260
      const h = config?.defaultHeight ?? 160
      const { x, y } = findNonOverlappingPosition(nodes, center.x - w / 2, center.y - h / 2, w, h)
      addRefNode(type, refId, x, y)
    },
    [getViewportCenter, nodes, addRefNode]
  )

  return (
    <div className="h-full w-full relative">
      <CanvasToolbar
        onAddText={handleAddText}
        onAddEntity={() => setEntityPickerOpen(true)}
        minimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={handleMoveEnd}
        onDoubleClick={handleDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={defaultViewport}
        defaultEdgeOptions={{ type: 'customEdge' }}
        connectionMode={ConnectionMode.Loose}
        panOnDrag
        selectionOnDrag={false}
        selectionKeyCode="Meta"
        onlyRenderVisibleElements
        fitView={nodes.length > 0}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        connectionRadius={20}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        {showMinimap && (
          <MiniMap zoomable pannable className="!bg-background !border-border" />
        )}
      </ReactFlow>
      <SelectionToolbar />
      <EntityPickerDialog
        open={entityPickerOpen}
        onOpenChange={setEntityPickerOpen}
        onSelect={handleEntitySelect}
      />
    </div>
  )
}
```

**핵심 변경점**:

- `useReactFlow()` 직접 사용 — `reactFlowInstance` ref + `onInit` 패턴 제거
- `findNonOverlappingPosition(nodes, ...)` — `store.getState().nodes` 대신 props의 `nodes` 사용 (순수 함수 호출)
- `onInit` prop 제거 — `useReactFlow()`가 대체
- 모든 ReactFlow 의존 로직이 이 컴포넌트에 집중

---

## 6. Phase 5: EntityPickerDialog ENTITY_TYPES 중복 제거

### 6.1 변경

**파일**: `src/renderer/src/widgets/canvas/ui/EntityPickerDialog.tsx`

**변경 전** (lines 4, 21-32):

```ts
import { Search, Check, FileText, Calendar, Sheet, ImageIcon } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'

const ENTITY_TYPES: { type: CanvasNodeType; label: string; icon: React.ElementType }[] = [
  { type: 'todo', label: '할 일', icon: Check },
  { type: 'note', label: '노트', icon: FileText },
  { type: 'schedule', label: '일정', icon: Calendar },
  { type: 'csv', label: 'CSV', icon: Sheet },
  { type: 'pdf', label: 'PDF', icon: PdfIcon },
  { type: 'image', label: '이미지', icon: ImageIcon }
]
```

**변경 후**:

```ts
import { Search } from 'lucide-react'
import { PICKABLE_TYPES } from '../model/node-type-registry'
```

- `ENTITY_TYPES` 상수 삭제
- 모든 `ENTITY_TYPES` 참조를 `PICKABLE_TYPES`로 대체
- `Check, FileText, Calendar, Sheet, ImageIcon` import 삭제
- `PdfIcon` import 삭제

나머지 코드(EntityPickerContent, 6개 entity hooks 일괄 호출)는 **현행 유지**.

---

## 7. Phase 6: 테스트

### 7.1 converters.test.ts

**파일**: `src/renderer/src/entities/canvas/model/__tests__/converters.test.ts` (신규)

**테스트 케이스**:

```
toReactFlowNode
  - text 타입 → type: 'textNode', data.nodeType: 'text'
  - ref 타입 (todo) → type: 'refNode', data.nodeType: 'todo'
  - refTitle 있을 때 → data.label = refTitle
  - refTitle 없을 때 → data.label = content fallback
  - style.width/height → DB width/height 반영
  - zIndex → 그대로 전달

toReactFlowEdge
  - style: 'solid' → strokeDasharray: undefined
  - style: 'dashed' → strokeDasharray: '5 5'
  - style: 'dotted' → strokeDasharray: '2 2'
  - arrow: 'none' → markerEnd: undefined
  - arrow: 'end' → markerEnd 있음, markerStart: undefined
  - arrow: 'both' → markerEnd + markerStart 모두 있음
  - color → style.stroke 매핑

parseSide (export하여 테스트)
  - 'right-source' → 'right'
  - 'top-target' → 'top'
  - 'bottom' → 'bottom'
  - null → 'right' (기본값)

toCreateCanvasEdgeData
  - source/target → fromNode/toNode
  - sourceHandle/targetHandle → fromSide/toSide (suffix 제거)
```

### 7.2 canvas-layout.test.ts

**파일**: `src/renderer/src/widgets/canvas/model/__tests__/canvas-layout.test.ts` (신규)

**테스트 케이스**:

```
findNonOverlappingPosition
  - 노드 없을 때 → baseX, baseY 그대로 반환
  - 겹치는 노드 1개 → offset 1회 이동
  - 연속 겹침 → offset 반복
  - 20회 시도 후 포기 → 마지막 위치 반환
  - custom width/height → 겹침 판정에 반영
```

### 7.3 use-canvas-store.test.ts

**파일**: `src/renderer/src/widgets/canvas/model/__tests__/use-canvas-store.test.ts` (신규)

**테스트 케이스**:

```
useCanvasStore
  - 동일 canvasId → 동일 store 반환
  - 다른 canvasId → 다른 store 반환
  - unmount → storeMap에서 제거, hydrated false
  - nodes/edges 초기값 → 빈 배열
  - hydrated 초기값 → false
```

### 7.4 use-canvas-hydration.test.ts

**파일**: `src/renderer/src/widgets/canvas/model/__tests__/use-canvas-hydration.test.ts` (신규)

**테스트 케이스**:

```
useCanvasHydration
  - DB 로딩 중 → hydration 하지 않음
  - 로딩 완료 → 최초 1회 hydration
  - 재호출 → hydration 스킵 (hydratedRef.current === true)
  - mutation 후 DB 노드 추가 → ID 비교로 store 갱신
  - mutation 후 DB 노드 수 변동 없음 → store 변경 없음
```

---

## 8. 변경 파일 총정리

| #   | Phase | 파일                                                          | 작업                              | 줄수 |
| --- | ----- | ------------------------------------------------------------- | --------------------------------- | ---- |
| 1   | 2     | `entities/canvas/model/types.ts`                              | 수정 — 제네릭 타입 추가           | +30  |
| 2   | 2     | `entities/canvas/model/converters.ts`                         | 수정 — 반환 타입 + if/return 분기 | ~90  |
| 3   | 2     | `entities/canvas/index.ts`                                    | 수정 — export 추가                | +1   |
| 4   | 2     | `widgets/canvas/ui/TextNode.tsx`                              | 수정 — 타입 단언 제거             | ~70  |
| 5   | 2     | `widgets/canvas/ui/RefNode.tsx`                               | 수정 — 타입 단언 제거             | ~125 |
| 6   | 3     | `widgets/canvas/model/node-type-registry.ts`                  | 신규 (ref-node-registry 대체)     | ~80  |
| 7   | 3     | `widgets/canvas/model/node-content-registry.ts`               | 수정 — NodeTypeConfig 제거        | ~6   |
| 8   | 1     | `widgets/canvas/model/use-canvas-store.ts`                    | 신규                              | ~60  |
| 9   | 1     | `widgets/canvas/model/use-canvas-hydration.ts`                | 신규                              | ~50  |
| 10  | 1     | `widgets/canvas/model/use-canvas-node-changes.ts`             | 신규                              | ~60  |
| 11  | 1     | `widgets/canvas/model/use-canvas-edge-changes.ts`             | 신규                              | ~40  |
| 12  | 1     | `widgets/canvas/model/use-canvas-data.ts`                     | 전면 재작성 (facade)              | ~65  |
| 13  | 4     | `widgets/canvas/model/canvas-layout.ts`                       | 신규                              | ~25  |
| 14  | 4     | `widgets/canvas/ui/CanvasBoard.tsx`                           | 전면 재작성 (Outer)               | ~30  |
| 15  | 4     | `widgets/canvas/ui/CanvasBoardInner.tsx`                      | 신규 (Inner)                      | ~110 |
| 16  | 5     | `widgets/canvas/ui/EntityPickerDialog.tsx`                    | 수정 — ENTITY_TYPES 제거          | ~155 |
| 17  | 6     | `entities/canvas/model/__tests__/converters.test.ts`          | 신규                              | ~120 |
| 18  | 6     | `widgets/canvas/model/__tests__/canvas-layout.test.ts`        | 신규                              | ~50  |
| 19  | 6     | `widgets/canvas/model/__tests__/use-canvas-store.test.ts`     | 신규                              | ~60  |
| 20  | 6     | `widgets/canvas/model/__tests__/use-canvas-hydration.test.ts` | 신규                              | ~80  |

**삭제 파일**: `widgets/canvas/model/ref-node-registry.ts` (node-type-registry.ts로 대체)

---

## 9. 검증 체크리스트

### Phase별 검증

| Phase   | 검증                                                               | 명령어                                                                          |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Phase 2 | typecheck 통과, `as unknown as` 0개                                | `npm run typecheck && grep -r "as unknown as" src/renderer/src/widgets/canvas/` |
| Phase 3 | `REF_NODE_REGISTRY` 참조 0개, `ENTITY_TYPES` 참조 0개              | `grep -r "REF_NODE_REGISTRY\|ENTITY_TYPES" src/renderer/`                       |
| Phase 1 | facade 반환 인터페이스 동일, typecheck                             | `npm run typecheck`                                                             |
| Phase 4 | 캔버스 수동 테스트 (노드 추가/이동/삭제, 엣지 연결, viewport 저장) | 수동                                                                            |
| Phase 5 | EntityPickerDialog 열기/검색/선택 동작                             | 수동                                                                            |
| Phase 6 | 전체 테스트 통과                                                   | `npm run test:web`                                                              |

### 최종 기능 검증 항목

1. 캔버스 열기 → 기존 노드/엣지 표시
2. 더블클릭 → 텍스트 노드 생성
3. 도구바 텍스트 추가 → viewport 중앙에 생성
4. EntityPicker → 참조 노드 추가 (6개 타입 모두)
5. 노드 드래그 → 위치 저장
6. 노드 리사이즈 → 크기 저장
7. 노드 삭제 (Delete 키)
8. 엣지 연결 (핸들 드래그)
9. 엣지 삭제
10. Viewport 이동/줌 → 500ms 후 저장
11. MiniMap 토글
12. SelectionToolbar 표시/삭제
13. 다른 탭으로 이동 후 다시 돌아오기 → 상태 유지
