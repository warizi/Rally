# Canvas 1차 구현 문제점 수정 Plan

> **Feature**: canvas-bugfix-v1
> **Type**: Bug Fix + UX Enhancement
> **Priority**: High
> **Created**: 2026-03-03

---

## 1. 문제점 요약

| #   | 문제                                              | 심각도   | 원인 분석                                                                                                                                          |
| --- | ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 노드/엣지 추가 시 즉시 반영 안됨 (탭 재오픈 필요) | Critical | Zustand store 1회성 hydration — mutation 후 DB 쿼리 invalidate는 되지만, store의 `hydratedRef`가 이미 `true`여서 새 데이터가 store에 반영되지 않음 |
| 2   | 노드 생성 위치가 화면 중앙이 아님                 | Medium   | 구현 자체는 되어 있으나 반영 안됨 버그와 연관                                                                                                      |
| 3   | 같은 위치에 노드 겹침                             | Low      | 기존 노드 위치 체크 없이 항상 동일 좌표에 생성                                                                                                     |
| 4   | RefNode 컨텐츠 미표시 (제목+미리보기만)           | Medium   | RefNode가 `refTitle`과 `refPreview`만 표시, 실제 컨텐츠(노트 내용, 할일 상세 등) 미노출                                                            |
| 5   | 노드 좌우 크기 조절 불가                          | Medium   | ReactFlow의 `NodeResizer` 미적용                                                                                                                   |
| 6   | 엣지 연결 불안정 (일부 방향만 연결됨)             | High     | Handle이 top/left=`target`, bottom/right=`source`로 고정되어 있어 같은 타입끼리 연결 불가. `ConnectionMode.Loose`가 있지만 여전히 방향 제약 존재   |
| 7   | 드래그 시 다중 선택 안됨 (팬만 됨)                | Medium   | `selectionOnDrag` 미설정(false), `panOnDrag` 기본값(true)이라 드래그=팬                                                                            |
| 8   | 스와이프/스크롤 팬 조작이 Cmd 없이 동작           | Medium   | `panOnDrag={true}` 기본값 → Cmd 키 바인딩 없음                                                                                                     |
| 9   | 요소 삭제 UI 없음                                 | Medium   | `deleteKeyCode`만 설정, 시각적 삭제 버튼/컨텍스트 메뉴 없음. 사용자가 삭제 방법을 알 수 없음                                                       |
| 10  | 엣지 선택/삭제 불가시                             | Medium   | CustomEdge가 `selected` prop 미사용 → 선택 시각 피드백 없음. 엣지 클릭 삭제 버튼도 없음. 노드 삭제와 동일하게 UI 부재                              |

---

## 2. 수정 계획

### Fix 1: 노드/엣지 추가 시 즉시 반영 (Critical)

**근본 원인**: `useCanvasData` hook에서 `hydratedRef`가 최초 1회만 hydration을 허용. 이후 mutation의 `invalidateQueries`로 `dbNodes`/`dbEdges`가 갱신되어도 store에 반영되지 않음.

**수정 방안**:

- mutation의 `onSuccess`에서 `invalidateQueries` 후 DB 데이터가 갱신될 때 store도 동기화
- `useEffect`에서 hydration 이후에도 `dbNodes`/`dbEdges` 변경 시 store를 동기화
- 기존 `hydratedRef` 1회 가드 → 데이터 변경 시 항상 store 갱신으로 변경

**수정 대상**:

- `src/renderer/src/widgets/canvas/model/use-canvas-data.ts` (hydration 로직 수정)

---

### Fix 2: 노드 생성 시 화면 중앙에 생성 + 겹침 회피 (Medium)

**수정 방안**:

- `addTextNode`/`addRefNode` 호출 시 viewport center 계산 (이미 `getViewportCenter` 존재)
- 기존 노드들과 겹침 감지: 중앙 좌표에 이미 노드가 있으면 우하단으로 30px씩 오프셋
- 여러 번 연속 생성 시에도 겹치지 않도록 반복 체크

**수정 대상**:

- `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx` (겹침 감지 로직 추가)

---

### Fix 3: RefNode 컨텐츠 표시 개선 (Medium)

**현재**: `refTitle`과 `refPreview`(최대 3줄)만 표시
**목표**: entity 타입별로 의미 있는 컨텐츠를 더 보여줌

**수정 방안**:

- RefNode 내부에 스크롤 가능한 컨텐츠 영역 추가 (`overflow-y-auto`)
- `refPreview`를 `line-clamp-3` → 스크롤 가능하게 변경
- 타입별 아이콘 + 라벨 헤더는 유지 (현재 구현 유지)
- 기본 생성 크기(260x160) 유지, 내부 컨텐츠가 넘치면 스크롤

**수정 대상**:

- `src/renderer/src/widgets/canvas/ui/RefNode.tsx` (컨텐츠 영역 스크롤)

---

### Fix 4: 노드 좌우 크기 조절 (Medium)

**수정 방안**:

- `@xyflow/react`의 `NodeResizer` 컴포넌트 활용
- TextNode, RefNode 모두에 `NodeResizer` 추가
- 리사이즈 완료 시 DB에 `width`/`height` 저장 (`useUpdateCanvasNode` 활용)
- 최소 크기 제한: `minWidth: 160`, `minHeight: 80`

**수정 대상**:

- `src/renderer/src/widgets/canvas/ui/TextNode.tsx` (NodeResizer 추가)
- `src/renderer/src/widgets/canvas/ui/RefNode.tsx` (NodeResizer 추가)
- `src/renderer/src/widgets/canvas/model/use-canvas-data.ts` (리사이즈 핸들링)

---

### Fix 5: 엣지 연결 안정화 (High)

**근본 원인**: Handle이 `type="target"` (top, left)과 `type="source"` (bottom, right)로 나뉘어 있어 source→target 방향으로만 연결 가능. 예: right(source) → left(target) 가능하지만, top(target) → top(target) 불가.

**수정 방안**:

- 모든 Handle을 `type="source"` 통일 (ReactFlow에서 `ConnectionMode.Loose`와 함께 모든 방향 연결 허용)
- 또는 각 위치에 source + target 핸들을 겹쳐 배치 (양방향 가능)
- 가장 안정적인 접근: 각 위치(top/right/bottom/left)마다 source + target 핸들을 동일 위치에 겹쳐 놓기

**수정 대상**:

- `src/renderer/src/widgets/canvas/ui/TextNode.tsx` (Handle 구성 변경)
- `src/renderer/src/widgets/canvas/ui/RefNode.tsx` (Handle 구성 변경)

---

### Fix 6: 드래그 다중 선택 + Cmd 팬 (Medium)

**현재**: 드래그 = 캔버스 팬 이동. 다중 선택은 Shift+클릭으로만 가능.
**목표**: 드래그 = 선택 박스(다중 선택), Cmd+드래그 = 팬

**수정 방안**:

- `panOnDrag={false}` — 기본 드래그를 팬에서 해제
- `selectionOnDrag={true}` — 드래그 시 선택 박스 활성화
- `panActivationKeyCode="Meta"` — Cmd 키 누른 상태에서 드래그 = 팬
- `zoomOnScroll={true}` (기본값 유지) — 스크롤/스와이프 = 줌
- `zoomOnPinch={true}` (기본값 유지) — 핀치 = 줌

**수정 대상**:

- `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx` (ReactFlow props 변경)

---

### Fix 7: 선택 요소 삭제 UI + 엣지 선택 피드백 (Medium)

**현재**: `deleteKeyCode={['Backspace', 'Delete']}`만 설정. 키보드 단축키를 모르면 삭제 불가. CustomEdge는 `selected` prop을 사용하지 않아 엣지가 선택되었는지 시각적으로 알 수 없음.
**목표**: 노드/엣지 선택 시 삭제 버튼을 시각적으로 제공 + 엣지 선택 시각 피드백

**수정 방안**:

- 선택된 노드/엣지가 있을 때 플로팅 액션바 표시 (CanvasToolbar 하단 또는 별도 컴포넌트)
- `useReactFlow().deleteElements()` 활용하여 선택된 요소 일괄 삭제
- 삭제 확인 없이 즉시 삭제 (Backspace와 동일 동작)
- 선택 개수 표시: "3개 선택됨" + 삭제 버튼
- CustomEdge에 `selected` prop 반영: 선택 시 엣지 색상 변경 (stroke: primary색) + 두께 증가
- 엣지 위에 삭제 버튼(×) 표시 — 선택 상태에서만 EdgeLabelRenderer로 렌더

**수정 대상**:

- `src/renderer/src/widgets/canvas/ui/CustomEdge.tsx` (selected 스타일 + 삭제 버튼)
- `src/renderer/src/widgets/canvas/ui/CanvasBoard.tsx` (선택 상태 감지 + 액션바)
- 또는 별도 `SelectionToolbar.tsx` 컴포넌트 생성

---

## 3. 수정 순서

```
1. Fix 1: 노드/엣지 즉시 반영 (가장 Critical, 다른 수정 테스트에도 필수)
2. Fix 5: 엣지 연결 안정화 (High 심각도)
3. Fix 6: 드래그 다중 선택 + Cmd 팬 (조작 기반, 다른 Fix 테스트에 필요)
4. Fix 7: 선택 요소 삭제 UI (Fix 6과 연동)
5. Fix 4: 노드 크기 조절
6. Fix 3: RefNode 컨텐츠 표시 개선
7. Fix 2: 겹침 회피 로직
```

---

## 4. 영향 범위

| 파일                                      | 수정 유형                           |
| ----------------------------------------- | ----------------------------------- |
| `widgets/canvas/model/use-canvas-data.ts` | Fix 1, Fix 4                        |
| `widgets/canvas/ui/CanvasBoard.tsx`       | Fix 2, Fix 6, Fix 7                 |
| `widgets/canvas/ui/TextNode.tsx`          | Fix 4, Fix 5                        |
| `widgets/canvas/ui/RefNode.tsx`           | Fix 3, Fix 4, Fix 5                 |
| `entities/canvas/model/converters.ts`     | Fix 4 (resizable 속성)              |
| `widgets/canvas/ui/CustomEdge.tsx`        | Fix 7 (selected 스타일 + 삭제 버튼) |
| `widgets/canvas/ui/SelectionToolbar.tsx`  | Fix 7 (신규 생성)                   |

**DB/Service/IPC 변경**: 없음 (기존 `updateNode`의 `width`/`height` 업데이트 API 이미 존재)

---

## 5. 비기능 요구사항

- 기존 캔버스 데이터 호환성 유지
- 새 패키지 설치 불필요 (`NodeResizer`는 `@xyflow/react`에 내장)
- 성능 영향 최소화: store 동기화는 shallow compare로 불필요한 리렌더 방지
