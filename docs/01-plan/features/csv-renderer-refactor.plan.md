# Plan: CSV Renderer 코드 분리 및 리팩토링

> 작성일: 2026-03-01
> 기능: csv-renderer-refactor
> 레벨: Dynamic

---

## 1. 배경 및 목적

`CsvTable.tsx`가 620줄 단일 컴포넌트로 다음 7가지 책임을 모두 담당하고 있다:
- 셀 선택 상태 관리 + 범위 계산
- 마우스 핸들러 (클릭, 드래그, 더블클릭)
- 클립보드 (복사/잘라내기/붙여넣기/삭제)
- 키보드 네비게이션 + 단축키
- 열 리사이즈
- 가상 스크롤링 (행/열)
- JSX 렌더링 (헤더, 행 번호, 데이터 그리드, 컨텍스트 메뉴)

**핵심 문제**:
1. 클립보드 로직이 컨텍스트 메뉴 핸들러(172-226)와 키보드 핸들러(236-293)에 **중복** 존재
2. 삭제 로직도 컨텍스트 메뉴(197-206)와 키보드(344-355)에 **중복** 존재
3. 단일 컴포넌트에 너무 많은 상태와 로직이 혼재하여 유지보수 어려움

**목표**: 커스텀 훅 추출로 책임을 분리하고, 중복 코드를 제거하여 CsvTable을 ~250줄 이하 순수 렌더링 컴포넌트로 축소한다.

---

## 2. 현재 파일 구조 및 줄 수

| 파일 | 줄 수 | 역할 |
|------|------|------|
| `widgets/csv-viewer/ui/CsvTable.tsx` | 620 | 테이블 렌더링 + 전체 로직 |
| `widgets/csv-viewer/ui/CsvViewer.tsx` | 181 | 오케스트레이터 |
| `widgets/csv-viewer/ui/CsvToolbar.tsx` | 54 | 툴바 UI |
| `widgets/csv-viewer/ui/EditableCell.tsx` | 75 | 셀 편집 UI |
| `widgets/csv-viewer/ui/EditableColumnHeader.tsx` | 63 | 헤더 편집 UI |
| `widgets/csv-viewer/model/use-csv-editor.ts` | 282 | 데이터 상태 + undo/redo + 자동 저장 |
| `widgets/csv-viewer/model/use-csv-external-sync.ts` | 19 | 외부 변경 감지 |
| **합계** | **1,294** | |

---

## 3. 리팩토링 대상 분석 — CsvTable.tsx 책임별 라인

| 책임 | 라인 범위 | 추정 줄 수 | 추출 대상 |
|------|----------|-----------|----------|
| 선택 상태 + 범위 계산 | 63-64, 110-124 | ~18 | `useCsvSelection` |
| 마우스 핸들러 | 127-161 | ~35 | `useCsvSelection` |
| 포커스 복원 | 162-169 | ~8 | `useCsvSelection` |
| 클립보드 (컨텍스트 메뉴) | 172-226 | ~55 | `useCsvClipboard` |
| 키보드 내비게이션 + 단축키 | 228-379 | ~152 | `useCsvKeyboard` |
| 블러 핸들러 | 381-386 | ~6 | `useCsvSelection` |
| 열 리사이즈 | 388-411 | ~24 | `useCsvColumnResize` |
| 가상화 + 렌더링 | 나머지 | ~322 | CsvTable (잔류) |

---

## 4. 변경 계획

### Phase A: 커스텀 훅 추출 (4개 신규 파일)

---

#### [A-1] `useCsvSelection` — 선택 상태 + 마우스 + 블러

**경로**: `src/renderer/src/widgets/csv-viewer/model/use-csv-selection.ts`

**추출 대상**:
- `selection` / `setSelection` 상태
- `editingCell` / `setEditingCell` 상태
- `isDragging` ref
- `contextMenuOpenRef` ref
- `selectionRange` useMemo (범위 계산)
- `isSingleSelection` 계산
- `handleCellMouseDown` / `handleCellMouseEnter` / `handleMouseUp` 핸들러
- `handleCellStartEdit` / `handleStopEdit` 핸들러
- 편집 후 포커스 복원 로직 (`wasEditingRef` + useEffect)
- `handleBlur` 핸들러
- 스크롤 연동 (`scrollToIndex` useEffect)

**반환 타입**:
```typescript
interface UseCsvSelectionReturn {
  selection: { anchor: CellPos; focus: CellPos } | null
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null
  isSingleSelection: boolean
  editingCell: CellPos | null
  contextMenuOpenRef: React.MutableRefObject<boolean>
  handleCellMouseDown: (row: number, col: number, e: React.MouseEvent) => void
  handleCellMouseEnter: (row: number, col: number) => void
  handleMouseUp: () => void
  handleCellStartEdit: (row: number, col: number) => void
  handleStopEdit: () => void
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void
  setSelection: React.Dispatch<React.SetStateAction<...>>
  setEditingCell: React.Dispatch<React.SetStateAction<CellPos | null>>
}
```

**인자**:
```typescript
function useCsvSelection(
  scrollRef: React.RefObject<HTMLDivElement>,
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>,
  colVirtualizer: Virtualizer<HTMLDivElement, Element>
): UseCsvSelectionReturn
```

---

#### [A-2] `useCsvClipboard` — 클립보드 통합 (중복 제거)

**경로**: `src/renderer/src/widgets/csv-viewer/model/use-csv-clipboard.ts`

**추출 대상**:
- `handleContextCopy` → `copy()`
- `handleContextCut` → `cut()`
- `handleContextPaste` → `paste()`
- `handleContextDelete` → `deleteSelection()`

**중복 제거**: 현재 키보드 핸들러(236-293)에서 복사/잘라내기/붙여넣기/삭제 로직이 컨텍스트 메뉴 핸들러와 거의 동일하게 반복됨. 이 훅에서 통합하고 키보드 핸들러는 이 훅의 메서드를 호출하도록 변경.

**반환 타입**:
```typescript
interface UseCsvClipboardReturn {
  copy: () => void
  cut: () => void
  paste: () => void
  deleteSelection: () => void
}
```

**인자**:
```typescript
function useCsvClipboard(
  selection: { anchor: CellPos; focus: CellPos } | null,
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null,
  data: string[][],
  headers: string[],
  onUpdateCells: (changes: { row: number; col: number; value: string }[]) => void
): UseCsvClipboardReturn
```

---

#### [A-3] `useCsvKeyboard` — 키보드 내비게이션 + 단축키

**경로**: `src/renderer/src/widgets/csv-viewer/model/use-csv-keyboard.ts`

**추출 대상**:
- `handleKeyDown` 전체 (228-379)
- 내부에서 `useCsvClipboard`의 `copy/cut/paste/deleteSelection` 호출
- Arrow / Tab / Enter / Escape / Backspace / Delete 처리
- Ctrl+Z/Shift+Ctrl+Z/Ctrl+Y (undo/redo)

**`e.preventDefault()` 분리 원칙**: 클립보드 메서드(`copy/cut/paste/deleteSelection`)는 순수 동작만 수행하고, `e.preventDefault()`는 반드시 키보드 핸들러 쪽에서만 호출한다.
```typescript
// 올바른 패턴
if (mod && e.key === 'c') {
  e.preventDefault()    // 키보드 핸들러 책임
  clipboard.copy()      // 순수 클립보드 동작
  return
}
```

**반환 타입**:
```typescript
interface UseCsvKeyboardReturn {
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}
```

**인자**:
```typescript
function useCsvKeyboard(
  selection: { anchor: CellPos; focus: CellPos } | null,
  selectionRange: { ... } | null,
  isSingleSelection: boolean,
  editingCell: CellPos | null,
  setSelection: React.Dispatch<...>,
  setEditingCell: React.Dispatch<...>,
  clipboard: UseCsvClipboardReturn,
  dataLength: number,
  headersLength: number,
  onUndo: () => void,
  onRedo: () => void
): UseCsvKeyboardReturn
```

---

#### [A-4] `useCsvColumnResize` — 열 리사이즈

**경로**: `src/renderer/src/widgets/csv-viewer/model/use-csv-column-resize.ts`

**추출 대상**:
- `handleResizeStart` (388-411)

**반환 타입**:
```typescript
interface UseCsvColumnResizeReturn {
  handleResizeStart: (colIndex: number, e: React.MouseEvent) => void
}
```

**인자**:
```typescript
function useCsvColumnResize(
  getColWidth: (index: number) => number,
  onColumnSizingChange: (updater: Updater<ColumnSizingState>) => void
): UseCsvColumnResizeReturn
```

---

### Phase B: CsvTable.tsx 리팩토링

기존 `CsvTable.tsx`에서 추출한 훅들을 사용하도록 변경:

```typescript
export function CsvTable({ ... }: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const rowNumRef = useRef<HTMLDivElement>(null)

  // 열 너비
  const getColWidth = useCallback(...)

  // 가상화
  const rowVirtualizer = useVirtualizer(...)
  const colVirtualizer = useVirtualizer(...)

  // 스크롤 동기화 useEffect (헤더/행번호)

  // 훅 조합
  const sel = useCsvSelection(scrollRef, rowVirtualizer, colVirtualizer)
  const clipboard = useCsvClipboard(sel.selection, sel.selectionRange, data, headers, onUpdateCells)
  const { handleKeyDown } = useCsvKeyboard(
    sel.selection, sel.selectionRange, sel.isSingleSelection,
    sel.editingCell, sel.setSelection, sel.setEditingCell,
    clipboard, data.length, headers.length, onUndo, onRedo
  )
  const { handleResizeStart } = useCsvColumnResize(getColWidth, onColumnSizingChange)

  // JSX만 남음 (~200줄)
}
```

**예상 결과**:
- CsvTable.tsx: 620줄 → ~250줄 (순수 렌더링 — 컨텍스트 메뉴 JSX 포함)
- 신규 훅 4개: ~280줄 합계
- 전체 코드 양: 중복 제거로 ~50줄 감소

---

### Phase C: 공통 타입 추출

**경로**: `src/renderer/src/widgets/csv-viewer/model/types.ts`

`CellPos` 타입이 현재 CsvTable.tsx 내부에 정의됨. 여러 훅에서 공유해야 하므로 별도 타입 파일로 추출.

```typescript
export type CellPos = { row: number; col: number }

export type SelectionRange = {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export type Selection = { anchor: CellPos; focus: CellPos }
```

상수도 함께 이동:
```typescript
export const ROW_HEIGHT = 28
export const HEADER_HEIGHT = 32
export const ROW_NUM_WIDTH = 50
export const ADD_COL_WIDTH = 40
export const DEFAULT_COL_WIDTH = 150
export const MIN_COL_WIDTH = 60
```

---

## 5. 변경 파일 목록

| # | 파일 | 작업 |
|---|------|------|
| 1 | `widgets/csv-viewer/model/types.ts` | **신규** — 공통 타입 + 상수 |
| 2 | `widgets/csv-viewer/model/use-csv-selection.ts` | **신규** — 선택/마우스/블러 |
| 3 | `widgets/csv-viewer/model/use-csv-clipboard.ts` | **신규** — 클립보드 통합 |
| 4 | `widgets/csv-viewer/model/use-csv-keyboard.ts` | **신규** — 키보드 내비게이션 |
| 5 | `widgets/csv-viewer/model/use-csv-column-resize.ts` | **신규** — 열 리사이즈 |
| 6 | `widgets/csv-viewer/ui/CsvTable.tsx` | **수정** — 훅 사용으로 축소 |

> CsvViewer.tsx, CsvToolbar.tsx, EditableCell.tsx, EditableColumnHeader.tsx — 변경 없음

---

## 6. 구현 순서

1. `types.ts` 생성 (타입/상수 — 의존성 없음)
2. `use-csv-selection.ts` 생성 (types.ts 의존)
3. `use-csv-clipboard.ts` 생성 (types.ts 의존)
4. `use-csv-keyboard.ts` 생성 (types.ts + clipboard 의존)
5. `use-csv-column-resize.ts` 생성 (types.ts 의존)
6. `CsvTable.tsx` 리팩토링 (모든 훅 조합)

---

## 7. 검증

```bash
npm run typecheck       # 타입 검사
npm run lint            # ESLint
```

> 기존 CSV 기능 테스트는 서비스/리포지토리 레이어에만 존재하며, 렌더러 컴포넌트 테스트는 없으므로 수동 검증:
> - 셀 선택 (클릭, Shift+클릭, 드래그)
> - 키보드 내비게이션 (화살표, Tab, Enter, Escape)
> - 클립보드 (Ctrl+C/X/V, 컨텍스트 메뉴)
> - 열 리사이즈 (드래그)
> - 행/열 추가·삭제 (컨텍스트 메뉴)
> - Undo/Redo (Ctrl+Z/Y)

---

## 8. 주의사항

- 훅 추출 시 `useCallback` 의존성 배열이 정확히 유지되어야 한다. 특히 `selection` 참조가 stale하지 않도록 주의.
- `useCsvSelection`에서 `scrollRef`를 받아 `scrollToIndex`를 호출하는 것이 virtualizer 인스턴스에 의존하므로, virtualizer를 인자로 전달해야 한다.
- `useCsvSelection` 내부 `scrollToIndex` useEffect는 virtualizer를 deps에서 의도적으로 제외한다. `eslint-disable-next-line react-hooks/exhaustive-deps` 주석을 반드시 유지해야 한다.
- `contextMenuOpenRef`는 블러 핸들러에서 참조하므로 `useCsvSelection` 내부에서 관리하되, CsvTable JSX에서 `ContextMenu`의 `onOpenChange`로 연결해야 한다.
- `use-csv-editor.ts` (282줄)는 이번 리팩토링 범위에 포함하지 않는다. 이미 적절히 분리되어 있으며, 변경 시 데이터 무결성 리스크가 있다.
