# Canvas 구조 리팩토링 Plan (v4)

> **Feature**: canvas-refactor-v4
> **Type**: Refactoring (Architecture)
> **Priority**: High
> **Created**: 2026-03-03
> **Reviewed**: 2026-03-03 (3차 점검 완료 — ReactFlow 컨텍스트 분석, FSD 준수 확인, 과잉 엔지니어링 제거)
> **Prerequisite**: canvas-bugfix-v1 완료 후 진행 (현재 버그픽스 기능은 유지)

---

## 1. 배경 및 목적

현재 Canvas 기능은 **canvas-visualization → canvas-refactor-v3 → canvas-bugfix-v1**을 거치며 기능적으로 동작하지만, 코드 구조적으로 여러 문제가 누적되어 있다. 새로운 노드 타입 추가, 엣지 타입 확장, 그룹핑 기능 등 향후 요구사항에 유연하게 대응하기 어려운 상태다.

이 리팩토링은 **유연성(Flexibility)**, **확장성(Extensibility)**, **가독성(Readability)** 세 가지 축을 중심으로 Canvas 전체 구조를 개선한다.

### 1.1 목표

| 축         | 목표                                             | 측정 기준                                                                                 |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **유연성** | 새 노드/엣지 타입 추가 시 수정 파일 최소화       | 새 노드 타입 추가 = 콘텐츠 컴포넌트 1개 + 레지스트리 1줄 + 백엔드 if 블록 1개 (현행 패턴) |
| **확장성** | 그룹, Undo/Redo, 컨텍스트 메뉴 등 기능 추가 가능 | 기존 코드 수정 없이 hook 조합으로 기능 추가                                               |
| **가독성** | 각 파일의 책임이 명확하고, 한 파일이 100줄 이내  | God Hook 분해, 더블 타입 단언 제거                                                        |

---

## 2. 현재 문제점 분석

### 2.1 God Hook — `use-canvas-data.ts` (272줄)

**현재 책임**:

1. Per-canvas Zustand store 생성/관리 (storeMap)
2. React Query에서 DB 데이터 fetch
3. Hydration (DB → Store 초기 동기화)
4. Mutation 후 동기화 (DB 변경 → Store 반영)
5. Unmount 시 store 정리
6. Viewport 기본값 계산
7. `onNodesChange` — position/resize/remove 핸들링
8. `onEdgesChange` — remove 핸들링
9. `onConnect` — 엣지 생성
10. `saveViewport` — viewport 저장
11. `addTextNode` / `addRefNode` — 노드 생성

**문제**: SRP(Single Responsibility Principle) 위반. 11가지 관심사가 하나의 hook에 혼재. 수정 시 다른 기능에 대한 사이드이펙트 파악이 어렵다.

### 2.2 타입 안전성 부족

```typescript
// RefNode.tsx — 이중 타입 단언
const nodeData = data as unknown as RefNodeData

// TextNode.tsx — 동일
const nodeData = data as unknown as TextNodeData
```

ReactFlow의 `Node` 타입이 generic하지만, 프로젝트에서 custom data 타입을 제대로 연결하지 않아 `as unknown as` 패턴이 반복된다. 이는 타입 시스템의 보호를 무력화한다.

### 2.3 CanvasBoard — 혼재된 관심사 (202줄)

| 관심사                       | 코드 위치                             | 문제                                                                    |
| ---------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| ReactFlowProvider 래핑       | 컴포넌트 내부 JSX                     | `useCanvasData`가 Provider 외부에서 호출되어 `useReactFlow()` 사용 불가 |
| 겹침 회피 로직               | `findNonOverlappingPosition()`        | **순수 알고리즘**이 UI 컴포넌트에 위치 → 유틸로 추출 가능               |
| viewport/node 오케스트레이션 | `handleAddText`, `handleEntitySelect` | ReactFlow 인스턴스 의존 로직이 렌더링과 혼재                            |

> **주의**: 다음은 **문제가 아닌** 현재 올바른 패턴:
>
> - `getViewportCenter()` — ReactFlowInstance + DOM 의존으로 순수 함수가 아님. 컴포넌트 종속이 정당
> - `handleDoubleClick()` — 표준 React 이벤트 핸들러 패턴
> - `showMinimap` state — 로컬 UI 상태로 현재 위치 적절

### 2.4 EntityPickerDialog — 레지스트리 이중화

```typescript
// EntityPickerDialog.tsx
const ENTITY_TYPES = [
  { type: 'todo', label: '할 일', icon: Check },
  { type: 'note', label: '노트', icon: FileText },
  // ...
]

// ref-node-registry.ts
export const REF_NODE_REGISTRY = {
  todo: { icon: Check, label: '할 일', ... },
  note: { icon: FileText, label: '노트', ... },
  // ...
}
```

동일한 정보(타입별 icon, label)가 두 곳에 중복 정의되어 있다. 새 타입 추가 시 두 곳 모두 수정해야 한다.

### 2.5 백엔드 `batchFetchRefs` — if/else 체인 (**검증 결과: 현행 유지**)

```typescript
// canvas-node.ts (service)
if (idsByType.todo?.length) {
  for (const t of todoRepository.findByIds(idsByType.todo)) { ... }
}
if (idsByType.note?.length) {
  for (const n of noteRepository.findByIds(idsByType.note)) { ... }
}
// ... 6개 타입 반복
```

> **안전성 검증 결과**: 이 if/else 체인은 **리팩토링 대상에서 제외**한다.
>
> - 총 69줄, 동기 실행, 명시적 구조
> - 타입별 RefData 추출 로직이 크게 상이 (todo: meta 5개, schedule: 7개, 나머지: 0개)
> - 공통 인터페이스 강제 시 `Record<string, unknown>` 남발로 타입 안전성 손실
> - 엔티티 타입 6개는 레지스트리 패턴의 손익분기점 이하
> - **10개 이상 타입 추가 시 재검토**

### 2.6 타입 정의 중복

`CanvasNodeItem`이 **3곳**에 정의되어 있다:

1. `src/main/services/canvas-node.ts` (backend)
2. `src/renderer/src/entities/canvas/model/types.ts` (frontend)
3. `src/preload/index.d.ts` (bridge)

이는 Electron 구조상 불가피하지만, preload 타입이 서비스 반환 타입과 정확히 일치하는지 수동으로 확인해야 한다.

### 2.7 테스트 부재

| 영역                  | 테스트 수 | 중요도                     |
| --------------------- | --------- | -------------------------- |
| `use-canvas-data.ts`  | 0         | Critical (hydration, sync) |
| `CanvasBoard.tsx`     | 0         | High (이벤트 핸들링)       |
| `converters.ts`       | 0         | High (데이터 변환)         |
| Node/Edge 컴포넌트    | 0         | Medium                     |
| Backend canvas 서비스 | 0         | High (비즈니스 로직)       |

### 2.8 미구현 확장 포인트

| 항목                   | 상태          | 설명                        |
| ---------------------- | ------------- | --------------------------- |
| `canvas_groups` 테이블 | 스키마만 존재 | service/repository/IPC 없음 |
| Undo/Redo              | 미구현        | 실수 복구 불가              |
| 컨텍스트 메뉴          | 미구현        | 우클릭 액션 없음            |
| 엣지 타입 확장         | 하드코딩      | `customEdge` 하나만 존재    |

---

## 3. 리팩토링 계획

### Phase 1: Hook 분해 (가독성 + 확장성) — 안전성 검증 완료

**목표**: `use-canvas-data.ts`(272줄)를 단일 책임 hook으로 분해

> **안전성 검증 요약** (3개 항목 모두 PASS):
>
> | 검증 항목                    | 결과     | 핵심 근거                                                                 |
> | ---------------------------- | -------- | ------------------------------------------------------------------------- |
> | Zustand StoreApi 참조 안정성 | **SAFE** | `createStore()` 반환 객체는 참조 불변, `useMemo([canvasId])` 안정         |
> | React Query mutation 분리    | **SAFE** | `useQueryClient()`는 글로벌 인스턴스, cache invalidation은 hook 위치 무관 |
> | useEffect 실행 순서          | **SAFE** | React 18+는 선언 순서 보장 (다른 hook 내부라도 호출 순서에 따름)          |
>
> **필수 구현 규칙**:
>
> 1. `hydratedRef`는 hydration hook이 소유, `{ hydratedRef }` 형태로 반환
> 2. Unmount cleanup(store.reset + storeMap.delete + hydratedRef.reset)은 **store hook 하나에 통합** (분리 시 역순 cleanup이지만 멱등성으로 안전)
> 3. Facade hook에서 sub-hook 호출 순서 = hydration → nodeSync → edgeSync → store cleanup (effect 순서 보장)

#### 3.1.1 `use-canvas-store.ts` — Store 관리

**책임**: Per-canvas Zustand store 생성, 접근, cleanup

```
현재: use-canvas-data.ts lines 33-66 (storeMap, getOrCreateStore, CanvasFlowState)
분리: use-canvas-store.ts (독립 모듈)
```

포함 내용:

- `CanvasFlowState` 인터페이스 정의
- `storeMap` (per-canvas store 맵)
- `getOrCreateStore(canvasId)` — store 팩토리
- `useCanvasStore(canvasId)` — hook wrapper (store 생성 + cleanup)
- 메모이제이션된 selector hooks: `useCanvasNodes(store)`, `useCanvasEdges(store)`

**장점**:

- Store 로직을 독립적으로 테스트 가능
- Store 구조 변경이 다른 hook에 영향 없음

#### 3.1.2 `use-canvas-hydration.ts` — DB↔Store 동기화

**책임**: DB 데이터를 store에 반영 (초기 hydration + mutation 후 sync)

```
현재: use-canvas-data.ts lines 93-121 (hydratedRef, 3개 useEffect)
분리: use-canvas-hydration.ts
```

포함 내용:

- 초기 hydration effect (최초 1회)
- Mutation 후 sync effect (ID 비교 기반 incremental sync)
- `isHydrated` 상태 노출

**장점**:

- Hydration 전략 변경 시 이 파일만 수정
- Hydration 로직 단위 테스트 가능

#### 3.1.3 `use-canvas-node-changes.ts` — Node 변경 핸들링

**책임**: `onNodesChange` 콜백 — position/resize/remove 이벤트를 DB에 반영

```
현재: use-canvas-data.ts lines 144-194
분리: use-canvas-node-changes.ts
```

포함 내용:

- Position change → `updatePositions` mutation
- Dimensions change → `updateNode` mutation (resize)
- Remove change → `removeNode` mutation
- `onNodesChange: OnNodesChange` 반환

#### 3.1.4 `use-canvas-edge-changes.ts` — Edge 변경 핸들링

**책임**: `onEdgesChange` + `onConnect` — edge remove/create

```
현재: use-canvas-data.ts lines 196-217
분리: use-canvas-edge-changes.ts
```

#### ~~3.1.5 `use-canvas-viewport.ts`~~ — 철회 (3차 점검)

> **철회 사유**: `onMoveEnd` 핸들러가 `ReactFlowInstance.getViewport()`에 의존하나, facade hook은 `ReactFlowProvider` 외부에서 호출됨 → `useReactFlow()` 사용 불가.
>
> - `defaultViewport` (DB 기반) + `saveViewport` (mutation) → **facade에 직접 유지** (ReactFlow 불필요)
> - `onMoveEnd` (ReactFlow 인스턴스 의존) → **CanvasBoardInner에 유지** (Phase 4)

#### ~~3.1.6 `use-canvas-node-factory.ts`~~ — 철회 (3차 점검)

> **철회 사유**: `addNodeAtCenter()`가 `getViewportCenter()`에 의존하고, 이는 `ReactFlowInstance.screenToFlowPosition()` 필요 → facade에서 사용 불가.
>
> - `addTextNode(x, y)` + `addRefNode(type, refId, x, y)` → **facade에 직접 유지** (좌표를 매개변수로 받으므로 ReactFlow 불필요)
> - `getViewportCenter()` + 오케스트레이션 (`handleAddText`, `handleEntitySelect`) → **CanvasBoardInner에 유지** (Phase 4)
> - `findNonOverlappingPosition()` → **`canvas-layout.ts` 순수 함수로 추출** (nodes 배열을 매개변수로 받음)

#### 3.1.5 `use-canvas-data.ts` — Facade Hook (조합)

**책임**: 위 hook들을 조합하여 단일 인터페이스 제공. **ReactFlow 의존성 없음** (Provider 외부에서 호출 가능)

```typescript
export function useCanvasData(canvasId: string) {
  const { store, nodes, edges } = useCanvasStore(canvasId)
  const { isLoading, hydrated } = useCanvasHydration(canvasId, store)
  const { onNodesChange } = useCanvasNodeChanges(canvasId, store)
  const { onEdgesChange, onConnect } = useCanvasEdgeChanges(canvasId, store)

  // viewport/node creation mutations (ReactFlow 불필요 — 좌표를 매개변수로 받음)
  const defaultViewport = useMemo(/* canvas DB 데이터 기반 */)
  const saveViewport = useSaveViewportMutation(canvasId)
  const addTextNode = useAddTextNodeMutation(canvasId)
  const addRefNode = useAddRefNodeMutation(canvasId)

  return { nodes, edges, isLoading, hydrated, defaultViewport, saveViewport, addTextNode, addRefNode, store, ... }
}
```

**결과**: 4개 sub-hook + facade 내 mutation = ~30줄. ReactFlow 의존 로직(onMoveEnd, getViewportCenter, handleAddText 등)은 CanvasBoardInner(Phase 4)에 위치

> **총 줄수 현실**: 기존 272줄(1파일) → ~240줄(5파일) + import/export 보일러플레이트 ~40줄 = **~280줄(5파일)**. 총 줄수는 미소 증가하나, 파일당 50-60줄로 가독성·테스트성 대폭 향상

---

### Phase 2: 타입 안전성 강화 (가독성) — 타당성 검증 완료

#### 3.2.1 ReactFlow 제네릭 타입 적용

**현재 문제**:

```typescript
// 모든 곳에서 data를 unknown으로 처리
const nodeData = data as unknown as RefNodeData
```

**수정 방향**: ReactFlow v12의 generic Node 타입 활용

> **타당성 검증 결과** (@xyflow/react v12.10.1 타입 정의 직접 확인):
>
> | API                   | 제네릭 지원                               | 확인 위치                                |
> | --------------------- | ----------------------------------------- | ---------------------------------------- |
> | `NodeProps<T>`        | `NodeProps<NodeType extends Node = Node>` | @xyflow/system types/nodes.d.ts          |
> | `Node<D, T>`          | `Node<NodeData, NodeType extends string>` | @xyflow/react types/nodes.d.ts           |
> | `applyNodeChanges<T>` | 입력·출력 동일 제네릭 보존                | @xyflow/react utils/changes.d.ts         |
> | `OnNodesChange<T>`    | `OnNodesChange<NodeType extends Node>`    | @xyflow/react types/general.d.ts         |
> | `useReactFlow<N, E>`  | `getNodes(): NodeType[]` 타입 반환        | @xyflow/react types/instance.d.ts        |
> | `ReactFlow<N, E>`     | `nodes?: NodeType[]` 제네릭 props         | @xyflow/react types/component-props.d.ts |
>
> **결론**: `as unknown as` 제거가 **완전히 안전**하며, ReactFlow v12가 처음부터 제네릭 기반으로 설계됨

```typescript
// types.ts
export type TextNodeData = {
  canvasId: string
  nodeType: 'text'
  content: string | null
  color: string | null
}

export type RefNodeData = {
  nodeType: string
  refId: string | null
  refTitle: string | undefined
  refPreview: string | undefined
  refMeta: Record<string, unknown> | undefined
  content: string | null
  color: string | null
}

export type CanvasNode = Node<TextNodeData, 'textNode'> | Node<RefNodeData, 'refNode'>
export type CanvasEdge = Edge<{
  edgeStyle: string
  arrow: string
  color: string | null
  fromSide: string
  toSide: string
}>
```

**수정 대상**:

- `entities/canvas/model/types.ts` — CanvasNode, CanvasEdge 타입 추가
- `converters.ts` — 반환 타입을 `CanvasNode`/`CanvasEdge`로 변경
- `TextNode.tsx` — `NodeProps<Node<TextNodeData>>` 사용, as 단언 제거
- `RefNode.tsx` — `NodeProps<Node<RefNodeData>>` 사용, as 단언 제거
- `use-canvas-store.ts` — `CanvasFlowState.nodes: CanvasNode[]`

**장점**: 타입 단언 0개, 컴파일 타임에 데이터 구조 오류 검출

#### 3.2.2 Edge 데이터 타입 정리

**현재**: `toReactFlowEdge`에서 `data` 필드에 임의 객체 넣음
**수정**: `CanvasEdgeData` 타입 정의 후 Edge generic에 적용

---

### Phase 3: 프론트엔드 레지스트리 통합 (유연성) — 백엔드 제외

#### 3.3.1 통합 NodeTypeRegistry

**현재**: `ref-node-registry.ts`(위젯 레이어)와 `EntityPickerDialog.tsx`의 `ENTITY_TYPES`가 중복

**수정 방향**: 하나의 레지스트리에서 모든 노드 타입 관련 설정을 관리

```typescript
// model/node-type-registry.ts

export interface NodeTypeConfig {
  // 렌더링
  component: React.ComponentType<NodeContentProps>
  icon: React.ElementType
  label: string

  // 크기
  defaultWidth: number
  defaultHeight: number
  resizable: boolean

  // EntityPicker용 (검색 가능 여부, 카테고리 등)
  pickable: boolean  // EntityPickerDialog에 표시할지
}

export const NODE_TYPE_REGISTRY: Record<CanvasNodeType, NodeTypeConfig> = {
  text: {
    component: () => null,  // TextNode은 별도 처리
    icon: Type,
    label: '텍스트',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: true,
    pickable: false  // EntityPicker에서 제외
  },
  todo: { ... pickable: true },
  note: { ... pickable: true },
  // ...
}

// 파생 데이터 (computed)
export const PICKABLE_TYPES = Object.entries(NODE_TYPE_REGISTRY)
  .filter(([, config]) => config.pickable)
  .map(([type, config]) => ({ type: type as CanvasNodeType, ...config }))
```

**수정 대상**:

- `ref-node-registry.ts` → `node-type-registry.ts`로 이름 변경 및 확장
- `EntityPickerDialog.tsx` — `ENTITY_TYPES` 삭제, `PICKABLE_TYPES` 사용
- `CanvasBoardInner.tsx` — 레지스트리에서 크기 조회 (노드 생성 오케스트레이션)

**효과**: 새 노드 타입 추가 시 레지스트리에 1개 엔트리 추가 → 전체 시스템 반영

#### 3.3.2 백엔드 `batchFetchRefs` — ~~레지스트리~~ 현행 유지 (검증 후 철회)

> **검증 결과**: 레지스트리 패턴 적용을 **철회**한다.
>
> **철회 사유**:
>
> 1. 현재 if/else는 69줄, 동기 실행으로 충분히 간결
> 2. 타입별 meta 추출 로직이 크게 상이하여 공통 인터페이스가 `Record<string, unknown>`으로 퇴화
> 3. 레지스트리 도입 시 간접 참조(indirection) 추가 대비 실질적 이득 없음
> 4. 엔티티 타입은 최근 일괄 추가(3개/1일)되었으며, 핵심 세트가 안정화된 상태
> 5. 6개 분기는 레지스트리 패턴의 ROI 손익분기점(~10개) 미만
>
> **재검토 조건**: 엔티티 타입이 10개 이상이 되거나, 외부 모듈에서 동적으로 타입을 등록해야 할 때

---

### Phase 4: CanvasBoard 분해 (가독성) — 3차 점검 후 수정

#### 3.4.1 ~~ReactFlowProvider를 page로 이동~~ → Outer/Inner 패턴 (3차 점검 수정)

**현재**: `CanvasBoard` 내부에서 `useCanvasData(canvasId)` 호출(line 37) → `<ReactFlowProvider>` 래핑(line 154)
**문제**: facade hook이 Provider 외부에서 실행되어 `useReactFlow()` 사용 불가

> **3차 점검 — Provider를 page로 이동 안 철회**:
>
> - `CanvasDetailPage`에 `ReactFlowProvider` 이동 시 page가 `@xyflow/react`에 직접 의존
> - **FSD 원칙 위반**: page 레이어가 widget의 내부 구현(`@xyflow/react`)을 알아야 함
> - 다른 페이지에서 CanvasBoard를 재사용할 때마다 Provider를 감싸야 하는 부담

**수정**: CanvasBoard를 **Outer/Inner 패턴**으로 분리 — Provider는 widget 내부 유지

```typescript
// widgets/canvas/ui/CanvasBoard.tsx (Outer — ~30줄)
export function CanvasBoard({ canvasId }: CanvasBoardProps): React.JSX.Element {
  const canvasData = useCanvasData(canvasId) // ← Provider 외부 — ReactFlow 의존 없음

  if (!canvasData.isReady) return <Loading />

  return (
    <ReactFlowProvider>
      <CanvasBoardInner canvasId={canvasId} {...canvasData} />
    </ReactFlowProvider>
  )
}

// widgets/canvas/ui/CanvasBoardInner.tsx (Inner — ~100줄)
function CanvasBoardInner({ canvasId, nodes, edges, ... }: InnerProps): React.JSX.Element {
  const reactFlow = useReactFlow() // ← Provider 내부 — 안전하게 사용 가능

  // viewport 관련 (ReactFlow 의존)
  const handleMoveEnd = useCallback(() => {
    const viewport = reactFlow.getViewport()
    // debounced saveViewport...
  }, [reactFlow, saveViewport])

  // node 생성 오케스트레이션 (ReactFlow 의존)
  const getViewportCenter = useCallback(() => {
    // reactFlow.screenToFlowPosition() 사용
  }, [reactFlow])

  const handleAddText = useCallback(() => {
    const center = getViewportCenter()
    const pos = findNonOverlappingPosition(nodes, center.x, center.y)
    addTextNode(pos.x, pos.y)
  }, [getViewportCenter, nodes, addTextNode])

  return (
    <ReactFlow onMoveEnd={handleMoveEnd} ... >
      ...
    </ReactFlow>
    <SelectionToolbar /> // ← ReactFlowProvider 내부 — useReactFlow() 동작
  )
}
```

> **안전성**:
>
> | 컴포넌트           | useReactFlow?   | useStore? | Outer/Inner 후                              |
> | ------------------ | --------------- | --------- | ------------------------------------------- |
> | CanvasToolbar      | NO              | NO        | Outer 또는 Inner — **안전**                 |
> | SelectionToolbar   | YES             | YES       | Inner 내부 (Provider 내) — **안전**         |
> | EntityPickerDialog | NO              | NO        | Outer 또는 Inner — **안전**                 |
> | TextNode/RefNode   | useStore (간접) | 간접      | ReactFlow이 렌더 → Provider 내부 — **안전** |
>
> **주의**: `SelectionToolbar`는 `<ReactFlowProvider>` 자식이면 동작 (현재 코드에서도 `<ReactFlow>` 밖, Provider 안에 위치 — line 193)

#### 3.4.2 유틸리티 함수 추출

**현재**: `findNonOverlappingPosition`이 CanvasBoard 내부 useCallback으로 정의 (store 의존)

**수정**: `model/canvas-layout.ts`로 추출 — **순수 함수** (nodes 배열을 매개변수로 받음)

```typescript
// model/canvas-layout.ts
export function findNonOverlappingPosition(
  nodes: Node[],
  baseX: number,
  baseY: number,
  width?: number,
  height?: number
): { x: number; y: number }
```

> `getViewportCenter()`는 순수 함수가 **아님** (ReactFlowInstance + DOM 의존) → `CanvasBoardInner`에 유지

#### 3.4.3 이벤트 핸들러 정리

**현재**: `handleAddText`, `handleEntitySelect`, `handleDoubleClick`, `handleInit`, `handleMoveEnd`가 CanvasBoard에 나열

**수정**:

- `onMoveEnd`, `handleDoubleClick`, `handleAddText`, `handleEntitySelect` → **CanvasBoardInner**에 위치 (ReactFlow 의존)
- `handleInit` → **제거** (`useReactFlow()` 사용으로 onInit 불필요)
- CanvasBoard Outer는 props 전달만

---

### Phase 5: EntityPickerDialog 개선 (유연성) — 3차 점검 후 축소

#### ~~3.5.1 타입별 lazy fetch~~ — 철회 (3차 점검)

> **철회 사유** (과잉 엔지니어링):
>
> 1. 현재 코드에 이미 `{open && workspaceId ? <EntityPickerContent /> : null}` 패턴 적용 → Dialog가 닫혀있으면 hook 실행 안 됨
> 2. 6개 IPC→SQLite 쿼리는 서브밀리초 (better-sqlite3 in-process, 동기 실행)
> 3. React Query 캐시에 이미 존재하는 경우 네트워크 호출 0
> 4. 6개 타입별 컴포넌트 추가 시 **~180줄 증가** 대비 **<5ms 절감** → ROI 부적합

#### 3.5.1 ENTITY_TYPES 중복 제거 (유지)

**현재**: `ENTITY_TYPES` 배열이 `ref-node-registry.ts`의 icon/label과 중복
**수정**: Phase 3에서 통합된 `NODE_TYPE_REGISTRY`의 `PICKABLE_TYPES` 사용

```typescript
// EntityPickerDialog.tsx — 변경 전
const ENTITY_TYPES = [
  { type: 'todo', label: '할 일', icon: Check }
  // ... 6개 하드코딩
]

// EntityPickerDialog.tsx — 변경 후
import { PICKABLE_TYPES } from '../model/node-type-registry'
// ENTITY_TYPES 제거, PICKABLE_TYPES 직접 사용
```

**6개 entity hook 일괄 호출은 현행 유지** — SQLite 서브밀리초 + React Query 캐시로 성능 문제 없음

---

### Phase 6: 테스트 인프라 구축 (가독성 + 안정성)

#### 3.6.1 순수 함수 테스트

| 함수                         | 파일               | 테스트 내용                |
| ---------------------------- | ------------------ | -------------------------- |
| `toReactFlowNode`            | `converters.ts`    | 모든 노드 타입 변환 정확성 |
| `toReactFlowEdge`            | `converters.ts`    | style/arrow/handle 변환    |
| `parseSide`                  | `converters.ts`    | handle suffix strip        |
| `findNonOverlappingPosition` | `canvas-layout.ts` | 겹침 회피, 최대 시도 제한  |

#### 3.6.2 Hook 테스트

| Hook                   | 테스트 내용                               |
| ---------------------- | ----------------------------------------- |
| `useCanvasStore`       | store 생성/정리, storeMap 관리            |
| `useCanvasHydration`   | 초기 hydration, mutation 후 sync, ID 비교 |
| `useCanvasNodeChanges` | position/resize/remove 핸들링             |
| `useCanvasEdgeChanges` | edge remove, onConnect 핸들링             |

#### 3.6.3 백엔드 서비스 테스트

| 서비스                           | 테스트 내용           |
| -------------------------------- | --------------------- |
| `canvasNodeService.findByCanvas` | batchFetchRefs 정확성 |
| `canvasNodeService.create`       | 기본값 적용, ID 생성  |
| `canvasEdgeService.create`       | 중복/self-loop 검증   |

---

## 4. 변경 파일 요약

### Phase 1: Hook 분해

| 파일                                                  | 작업          | 예상 줄수 |
| ----------------------------------------------------- | ------------- | --------- |
| `widgets/canvas/model/use-canvas-store.ts`            | 신규          | ~60       |
| `widgets/canvas/model/use-canvas-hydration.ts`        | 신규          | ~50       |
| `widgets/canvas/model/use-canvas-node-changes.ts`     | 신규          | ~60       |
| `widgets/canvas/model/use-canvas-edge-changes.ts`     | 신규          | ~40       |
| ~~`widgets/canvas/model/use-canvas-viewport.ts`~~     | ~~신규~~      | ~~철회~~  |
| ~~`widgets/canvas/model/use-canvas-node-factory.ts`~~ | ~~신규~~      | ~~철회~~  |
| `widgets/canvas/model/use-canvas-data.ts`             | 수정 (facade) | ~40       |

### Phase 2: 타입 안전성

| 파일                                  | 작업                                           |
| ------------------------------------- | ---------------------------------------------- |
| `entities/canvas/model/types.ts`      | 수정 — CanvasNode, CanvasEdge 제네릭 타입 추가 |
| `entities/canvas/model/converters.ts` | 수정 — 반환 타입 변경                          |
| `widgets/canvas/ui/TextNode.tsx`      | 수정 — 타입 단언 제거                          |
| `widgets/canvas/ui/RefNode.tsx`       | 수정 — 타입 단언 제거                          |

### Phase 3: 프론트엔드 레지스트리 통합 (백엔드 제외)

| 파일                                         | 작업                                      |
| -------------------------------------------- | ----------------------------------------- |
| `widgets/canvas/model/node-type-registry.ts` | 수정 (기존 `ref-node-registry.ts` 확장)   |
| `widgets/canvas/ui/EntityPickerDialog.tsx`   | 수정 — ENTITY_TYPES 제거, 레지스트리 사용 |
| ~~`main/services/canvas-node.ts`~~           | ~~수정~~ — **철회** (현행 유지)           |

### Phase 4: CanvasBoard 분해

| 파일                                              | 작업                                                   |
| ------------------------------------------------- | ------------------------------------------------------ |
| `widgets/canvas/model/canvas-layout.ts`           | 신규 — `findNonOverlappingPosition` 순수 함수          |
| `widgets/canvas/ui/CanvasBoard.tsx`               | 수정 — Outer 컴포넌트 (~30줄)                          |
| `widgets/canvas/ui/CanvasBoardInner.tsx`          | 신규 — Inner 컴포넌트 (~100줄, `useReactFlow()` 사용)  |
| ~~`pages/canvas-detail/ui/CanvasDetailPage.tsx`~~ | ~~수정~~ — **변경 없음** (Provider는 widget 내부 유지) |

### Phase 5: EntityPickerDialog 개선

| 파일                                       | 작업                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `widgets/canvas/ui/EntityPickerDialog.tsx` | 수정 — `ENTITY_TYPES` 제거, `PICKABLE_TYPES` 사용 |

### Phase 6: 테스트

| 파일                                                          | 작업 |
| ------------------------------------------------------------- | ---- |
| `entities/canvas/model/__tests__/converters.test.ts`          | 신규 |
| `widgets/canvas/model/__tests__/canvas-layout.test.ts`        | 신규 |
| `widgets/canvas/model/__tests__/use-canvas-store.test.ts`     | 신규 |
| `widgets/canvas/model/__tests__/use-canvas-hydration.test.ts` | 신규 |
| `main/services/__tests__/canvas-node.test.ts`                 | 신규 |
| `main/services/__tests__/canvas-edge.test.ts`                 | 신규 |

---

## 5. 작업 순서 및 의존성

```
Phase 2 (타입 안전성) ──────────┐
                                ├──→ Phase 1 (Hook 분해) ──→ Phase 4 (CanvasBoard 분해)
Phase 3 (프론트 레지스트리) ────┘                                       ↓
                                                              Phase 5 (EntityPicker 개선)
                                                                       ↓
                                                              Phase 6 (테스트)

※ 백엔드 변경 없음 (Phase 3에서 철회)
```

**권장 실행 순서** (3차 점검 반영):

1. **Phase 2** — 타입 기반을 먼저 정리 (후속 작업의 안전성 확보) — **리스크 최저, 효과 즉시**
2. **Phase 3** — 프론트엔드 레지스트리 통합 (Phase 1/5에서 참조) — **백엔드 제외**
3. **Phase 1** — Hook 분해 (핵심 리팩토링, Phase 2/3의 타입/레지스트리 활용) — **4개 sub-hook + facade**
4. **Phase 4** — CanvasBoard Outer/Inner 분리 (Phase 1 완료 후) — **FSD 위반 없는 Outer/Inner 패턴**
5. **Phase 5** — EntityPicker ENTITY_TYPES 중복 제거 (Phase 3 완료 후) — **lazy fetch 최적화 철회**
6. **Phase 6** — 테스트 (각 Phase 완료 시 점진적으로 추가)

---

## 6. 리팩토링 후 기대 구조

### 6.1 디렉토리 구조 (After)

```
widgets/canvas/
├── index.ts
├── model/
│   ├── node-type-registry.ts        ← 통합 레지스트리 (기존 ref-node-registry 대체)
│   ├── node-content-registry.ts     ← 타입 정의 (유지)
│   ├── canvas-layout.ts             ← 순수 유틸 (findNonOverlappingPosition)
│   ├── use-canvas-data.ts           ← Facade (~40줄, ReactFlow 의존 없음)
│   ├── use-canvas-store.ts          ← Store 관리 (~60줄)
│   ├── use-canvas-hydration.ts      ← DB↔Store 동기화 (~50줄)
│   ├── use-canvas-node-changes.ts   ← Node 변경 핸들링 (~60줄)
│   ├── use-canvas-edge-changes.ts   ← Edge 변경 핸들링 (~40줄)
│   └── __tests__/
│       ├── canvas-layout.test.ts
│       ├── use-canvas-store.test.ts
│       └── use-canvas-hydration.test.ts
└── ui/
    ├── CanvasBoard.tsx              ← Outer: facade + Provider 래핑 (~30줄)
    ├── CanvasBoardInner.tsx         ← Inner: useReactFlow() + 렌더링 (~100줄)
    ├── CanvasToolbar.tsx            ← (유지)
    ├── SelectionToolbar.tsx         ← (유지)
    ├── CustomEdge.tsx               ← (유지)
    ├── TextNode.tsx                 ← 타입 단언 제거
    ├── RefNode.tsx                  ← 타입 단언 제거
    ├── EntityPickerDialog.tsx       ← ENTITY_TYPES 중복 제거 (레지스트리 사용)
    └── node-content/                ← (유지)
```

### 6.2 새 노드 타입 추가 시 체크리스트 (After)

| #   | 작업                          | 파일                                 | 줄수 | 영역               |
| --- | ----------------------------- | ------------------------------------ | ---- | ------------------ |
| 1   | 콘텐츠 컴포넌트 작성          | `ui/node-content/NewTypeContent.tsx` | ~30  | 프론트엔드         |
| 2   | 레지스트리에 엔트리 추가      | `model/node-type-registry.ts`        | 1줄  | 프론트엔드         |
| 3   | batchFetchRefs에 if 블록 추가 | `main/services/canvas-node.ts`       | ~8줄 | 백엔드 (현행 패턴) |
| 4   | DB 스키마에 type enum 추가    | `main/db/schema/canvas-node.ts`      | 1줄  | 백엔드             |

**현재 (Before)**: 프론트엔드 5-6개 파일 수정 (EntityPickerDialog ENTITY_TYPES + ref-node-registry + RefNode 등)
**리팩토링 후 (After)**: 프론트엔드 = 컴포넌트 1개 + 레지스트리 1줄, 백엔드 = 기존 패턴 if 블록 추가

---

## 7. 리스크 및 완화 전략

| 리스크                             | 심각도             | 완화 전략                                 | 검증 상태                                            |
| ---------------------------------- | ------------------ | ----------------------------------------- | ---------------------------------------------------- |
| Hook 분해 시 기존 동작 깨짐        | High               | Phase별 `npm run typecheck` + 수동 테스트 | **검증 완료** — 4개 sub-hook (viewport/factory 철회) |
| ReactFlow 제네릭 호환성            | ~~Medium~~ **Low** | v12.10.1 타입 정의 직접 확인 완료         | **검증 완료** — 완벽 지원                            |
| 프론트엔드 레지스트리 통합 시 누락 | Low                | 기존 코드와 1:1 대응 검증                 | 미검증 (구현 시 확인)                                |
| ~~백엔드 레지스트리~~              | ~~Low~~            | ~~-~~                                     | **철회** — 타당성 부족                               |
| 테스트 작성 시간                   | Low                | 순수 함수부터 시작, hook 테스트는 점진적  | —                                                    |
| Effect 순서 의존성                 | Low                | Facade hook에서 호출 순서 고정, 주석 명시 | **검증 완료**                                        |
| Unmount cleanup 경합               | Very Low           | 모든 cleanup이 멱등성, store hook에 통합  | **검증 완료**                                        |

---

## 8. 비기능 요구사항

- **하위 호환성**: 기존 캔버스 데이터 100% 호환 (DB 스키마 변경 없음)
- **성능**: 리팩토링으로 인한 성능 저하 없음 (hook 분해는 런타임 영향 없음)
- **패키지**: 새 패키지 설치 불필요
- **DB/IPC 변경**: 없음 (프론트엔드 구조 변경만)
- **빌드**: `npm run typecheck` + `npm run lint` 통과 필수

---

## 9. 성공 기준

| 기준                       | 측정 방법                                                        |
| -------------------------- | ---------------------------------------------------------------- |
| God Hook 해소              | `use-canvas-data.ts` 40줄 이내 (facade), 각 sub-hook 80줄 이내   |
| 타입 단언 제거             | `as unknown as` 패턴 0개 (ReactFlow 제네릭 활용)                 |
| 프론트엔드 중복 제거       | EntityPickerDialog에서 `ENTITY_TYPES` 제거, 레지스트리 단일 소스 |
| 테스트 커버리지            | converters/layout 순수 함수 100%, hook 주요 경로 80%             |
| 새 노드 타입 추가 (프론트) | 콘텐츠 컴포넌트 1개 + 레지스트리 1줄로 완결                      |
| 기존 동작 유지             | `npm run typecheck` 통과 + 캔버스 전체 기능 수동 테스트 통과     |
| 백엔드 변경 없음           | `main/` 디렉토리 변경 파일 0개 (현행 유지)                       |

---

## 10. 안전성 검증 보고서 (2026-03-03)

### 10.1 검증 방법

3개 병렬 검증 에이전트로 실제 소스코드 및 타입 정의 파일을 직접 확인:

1. **ReactFlow v12 타입 정의 검증** — `node_modules/@xyflow/react/dist/esm/types/` 직접 읽기
2. **Hook 분해 안전성 검증** — React 18 effect 모델 + Zustand vanilla 참조 안정성 분석
3. **백엔드 레지스트리 타당성 검증** — 6개 repository의 findByIds 시그니처 + RefData 추출 로직 비교

### 10.2 검증 결과 요약

| Phase                  | 검증 결과                                                | 변경 사항                                          |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| Phase 1 (Hook 분해)    | **PASS** — 4개 sub-hook + facade (viewport/factory 철회) | cleanup 통합 규칙 추가, viewport/factory hook 철회 |
| Phase 2 (타입 안전성)  | **PASS** — ReactFlow v12.10.1 제네릭 완벽 지원           | 리스크 Medium→Low 하향                             |
| Phase 3 (레지스트리)   | **PARTIAL** — 프론트엔드 통합 유효, 백엔드 철회          | 백엔드 레지스트리 제거                             |
| Phase 4 (CanvasBoard)  | **REVISED** — Provider page 이동→Outer/Inner 패턴        | FSD 위반 방지, useReactFlow() 안전 사용            |
| Phase 5 (EntityPicker) | **REVISED** — lazy fetch 철회, 중복 제거만 유지          | 과잉 엔지니어링 제거                               |
| Phase 6 (테스트)       | 해당 없음                                                | —                                                  |

### 10.3 철회된 항목

| 항목                                   | 철회 사유                                                                  | 점검 차수 |
| -------------------------------------- | -------------------------------------------------------------------------- | --------- |
| 백엔드 `batchFetchRefs` 레지스트리화   | 6개 타입에 69줄 if/else는 과잉 추상화. 타입별 meta 구조 상이. ROI 미달     | 2차       |
| `use-canvas-viewport.ts` hook 분리     | `onMoveEnd`가 ReactFlowInstance 의존 → facade(Provider 외부)에서 사용 불가 | 3차       |
| `use-canvas-node-factory.ts` hook 분리 | `getViewportCenter()`가 ReactFlowInstance 의존 → facade에서 사용 불가      | 3차       |
| ReactFlowProvider를 page로 이동        | page가 `@xyflow/react`에 직접 의존 → FSD 위반 (widget 구현 누출)           | 3차       |
| EntityPicker 타입별 lazy fetch         | 이미 `{open && <Content/>}` 패턴 적용 + SQLite 서브밀리초 → ROI 부적합     | 3차       |

### 10.4 발견된 잠재 리스크 및 완화

| 리스크                                                        | 완화                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Facade hook 내 sub-hook 호출 순서 변경 시 effect 순서 변동    | 호출 순서 주석으로 명시, lint rule 고려                 |
| Unmount 시 hydratedRef.current 리셋이 다른 hook에 있으면 경합 | store hook에 모든 cleanup 통합 (단일 cleanup 원칙)      |
| `CanvasNode` 유니온 타입이 커지면 discriminated union 성능    | 현재 2개 타입(text/ref)은 문제 없음, 5개 이상 시 재검토 |
| Outer/Inner 분리 시 props 전달 보일러플레이트                 | InnerProps 타입 명시적 정의, facade 반환 타입 재사용    |

### 10.5 3차 점검 — 핵심 발견사항 (2026-03-03)

#### ReactFlowProvider 실행 컨텍스트 분석

```
CanvasBoard.tsx 실행 순서:
1. line 37: useCanvasData(canvasId)  ← Hook 실행 (Provider 외부)
2. line 52: useRef<ReactFlowInstance>  ← ref 패턴 (Provider 불필요)
3. line 86: getViewportCenter()  ← ReactFlowInstance 의존
4. line 154: <ReactFlowProvider>  ← 여기서부터 Provider context
5. line 162: <ReactFlow onInit={handleInit}>  ← ref에 instance 설정
6. line 193: <SelectionToolbar />  ← Provider 내부, ReactFlow 외부 (정상)
```

**결론**: `useCanvasData` facade는 반드시 Provider 외부에서 동작해야 하므로, ReactFlow 의존 로직(viewport 읽기, screenToFlowPosition)은 facade에 포함할 수 없다. Outer/Inner 패턴으로 해결.
