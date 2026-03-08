> **Feature**: canvas-refactor-v3
> **Type**: Refactoring
> **Priority**: Medium
> **Created**: 2026-03-03

---

## 1. 배경 및 목적

현재 캔버스의 `RefNode.tsx`에 모든 노드 타입의 렌더링 로직이 인라인으로 집중되어 있다. 새 엔티티 타입을 추가하려면 `RefNode.tsx`의 `TYPE_ICON`, `TYPE_LABEL`, 콘텐츠 분기문 등 여러 곳을 수정해야 한다.

이를 **레지스트리(Registry) 패턴**으로 리팩터링하여:

- 콘텐츠 컴포넌트 1개 생성 + 레지스트리 엔트리 1줄 추가만으로 새 노드 타입 지원
- 각 노드 타입의 렌더링을 독립적으로 관리
- FSD 레이어 규칙 준수

---

## 2. 현재 문제점

| #   | 문제                                        | 원인                                                                   |
| --- | ------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | 새 타입 추가 시 RefNode.tsx 5곳+ 수정 필요  | TYPE_ICON, TYPE_LABEL, 콘텐츠 분기, PRIORITY_CLASS 등이 한 파일에 집중 |
| 2   | todo만 전용 콘텐츠, 나머지는 generic        | 확장 고려 없는 if-else 분기                                            |
| 3   | 모든 RefNode가 동일 크기/동일 리사이즈 동작 | 타입별 설정 없음                                                       |
| 4   | todo 노드도 리사이즈 가능                   | 리사이즈 제한 메커니즘 없음                                            |

---

## 3. 수정 계획

### 3-1. NodeContentRegistry 타입 정의 (신규)

**파일**: `widgets/canvas/model/node-content-registry.ts`

- `NodeContentProps` (refTitle, refPreview, refMeta)
- `NodeTypeConfig` (component, icon, label, defaultWidth, defaultHeight, resizable)

### 3-2. 콘텐츠 컴포넌트 추출 (신규)

**디렉토리**: `widgets/canvas/ui/node-content/`

| 파일                     | 원본                                                          | 설명             |
| ------------------------ | ------------------------------------------------------------- | ---------------- |
| `TodoNodeContent.tsx`    | RefNode의 `TodoContent` + `PRIORITY_CLASS` + `PRIORITY_LABEL` | todo 전용 렌더링 |
| `DefaultNodeContent.tsx` | RefNode의 `DefaultContent`                                    | 범용 렌더링      |

### 3-3. 레지스트리 상수 (신규)

**파일**: `widgets/canvas/model/ref-node-registry.ts`

- 6개 타입 매핑 (todo=TodoNodeContent/resizable:false, 나머지=DefaultNodeContent/resizable:true)

### 3-4. RefNode 리팩터링 (수정)

- 인라인 코드 전부 삭제 → 레지스트리 기반 렌더링
- `NodeResizer isVisible={selected && config.resizable}`

### 3-5. addRefNode/handleEntitySelect 수정

- `use-canvas-data.ts` — 레지스트리에서 defaultWidth/Height 조회
- `CanvasBoard.tsx` — findNonOverlappingPosition에 per-type 크기 전달

---

## 4. 변경 파일 요약

| 파일                                                    | 작업 | 비고                             |
| ------------------------------------------------------- | ---- | -------------------------------- |
| `widgets/canvas/model/node-content-registry.ts`         | 신규 | 타입 정의                        |
| `widgets/canvas/model/ref-node-registry.ts`             | 신규 | 레지스트리 상수                  |
| `widgets/canvas/ui/node-content/TodoNodeContent.tsx`    | 신규 | todo 콘텐츠 추출                 |
| `widgets/canvas/ui/node-content/DefaultNodeContent.tsx` | 신규 | 기본 콘텐츠 추출                 |
| `widgets/canvas/ui/RefNode.tsx`                         | 수정 | 인라인 → 레지스트리 기반         |
| `widgets/canvas/model/use-canvas-data.ts`               | 수정 | addRefNode per-type 크기         |
| `widgets/canvas/ui/CanvasBoard.tsx`                     | 수정 | handleEntitySelect per-type 크기 |

**변경 없음**: entities/, TextNode.tsx, 백엔드 전체

---

## 5. 검증

- `npm run typecheck` — 타입 에러 없음
- 수동 테스트:
  - [ ] todo 노드: 체크/상태/우선순위/마감일 정상 표시
  - [ ] todo 노드: 선택 시 리사이즈 핸들 안 나타남
  - [ ] note/schedule/csv/pdf/image 노드: 제목+미리보기 정상 표시
  - [ ] note/schedule/csv/pdf/image 노드: 리사이즈 가능
  - [ ] TextNode 동작 영향 없음
  - [ ] 엣지 연결 정상
