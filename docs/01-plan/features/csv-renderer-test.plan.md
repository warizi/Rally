# Plan: CSV Renderer 테스트 코드 작성

> 작성일: 2026-03-01
> 기능: csv-renderer-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

CSV renderer 리팩토링(csv-renderer-refactor)으로 CsvTable.tsx에서 4개 커스텀 훅을 추출했다.
추출된 훅들의 비즈니스 로직을 검증하는 단위 테스트를 작성한다.

**대상**: 리팩토링으로 생성된 4개 훅
**제외**: `types.ts` (순수 타입/상수), `use-csv-editor.ts` (기존 코드, 별도 plan), UI 컴포넌트

---

## 2. 테스트 파일 목록

### Renderer — `vitest.config.web.mts` (`npm run test:web`)

| 파일 | 비고 |
|------|------|
| `src/renderer/src/widgets/csv-viewer/model/__tests__/use-csv-selection.test.ts` | renderHook + 이벤트 시뮬레이션 |
| `src/renderer/src/widgets/csv-viewer/model/__tests__/use-csv-clipboard.test.ts` | navigator.clipboard mock |
| `src/renderer/src/widgets/csv-viewer/model/__tests__/use-csv-keyboard.test.ts` | 키보드 이벤트 mock |
| `src/renderer/src/widgets/csv-viewer/model/__tests__/use-csv-column-resize.test.ts` | document 이벤트 리스너 mock |

> Renderer 환경은 `globals: true` → `describe`, `it`, `expect`, `vi`, `beforeEach` 등 import 불필요

---

## 3. 환경 설정

### 공통 Mock 패턴

**navigator.clipboard** (happy-dom에 없음):
```typescript
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue('')
}
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true })
```

**Virtualizer mock** (useCsvSelection 전용):
```typescript
const mockVirtualizer = { scrollToIndex: vi.fn() } as unknown as Virtualizer<HTMLDivElement, Element>
```

**scrollRef mock**:
```typescript
const mockScrollRef = { current: { focus: vi.fn() } as unknown as HTMLDivElement }
```

**키보드 이벤트 팩토리**:
```typescript
function createKeyEvent(key: string, opts?: Partial<React.KeyboardEvent>): React.KeyboardEvent<HTMLDivElement> {
  return { key, preventDefault: vi.fn(), metaKey: false, ctrlKey: false, shiftKey: false, ...opts } as unknown as React.KeyboardEvent<HTMLDivElement>
}
```

---

## 4. 테스트 케이스 상세

---

### [A] useCsvSelection

#### 초기 상태
| # | 설명 |
|---|------|
| 1 | selection === null |
| 2 | editingCell === null |
| 3 | selectionRange === null |
| 4 | isSingleSelection === false |

#### handleCellMouseDown
| # | 설명 |
|---|------|
| 5 | 좌클릭 → selection 설정 (anchor === focus) |
| 6 | button !== 0 → 무시 |
| 7 | Shift+클릭 → anchor 유지, focus 변경 |
| 8 | 클릭 시 editingCell 초기화 |
| 9 | 클릭 시 scrollRef.focus() 호출 |

#### selectionRange 계산
| # | 설명 |
|---|------|
| 10 | anchor < focus → startRow=anchor.row, endRow=focus.row, startCol=anchor.col, endCol=focus.col |
| 11 | anchor > focus (역방향) → startRow=focus.row, endRow=anchor.row, startCol=focus.col, endCol=anchor.col |

#### isSingleSelection
| # | 설명 |
|---|------|
| 12 | anchor === focus → true |
| 13 | anchor !== focus → false |

#### 드래그 (Mouse Enter / Up)
| # | 설명 |
|---|------|
| 14 | mouseDown 후 mouseEnter → focus 업데이트 (드래그) |
| 15 | mouseUp 후 mouseEnter → 변화 없음 (드래그 종료) |

#### 편집 모드
| # | 설명 |
|---|------|
| 16 | handleCellStartEdit → selection + editingCell 설정 |
| 17 | handleStopEdit → editingCell === null |
| 18 | 편집 종료 후 scrollRef.focus() 호출 (wasEditingRef) |

#### Blur
| # | 설명 |
|---|------|
| 19 | 외부로 포커스 이동 → selection + editingCell 초기화 |
| 20 | 컨테이너 내부 포커스 이동 → 유지 |
| 21 | contextMenuOpenRef === true → 유지 |

#### Virtualizer 연동
| # | 설명 |
|---|------|
| 22 | focus.row 변경 시 rowVirtualizer.scrollToIndex 호출 |
| 23 | focus.col 변경 시 colVirtualizer.scrollToIndex 호출 |

---

### [B] useCsvClipboard

**테스트 데이터**:
```typescript
const data = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
const headers = ['Col1', 'Col2', 'Col3']
```

#### copy
| # | 설명 |
|---|------|
| 1 | 단일 셀 복사 → clipboard.writeText('a') |
| 2 | 범위 복사 (2x2) → clipboard.writeText('a\tb\nd\te') |
| 3 | selectionRange === null → 아무 동작 없음 |

#### cut
| # | 설명 |
|---|------|
| 4 | 복사 후 셀 클리어 → writeText + onUpdateCells(value: '') 호출 |

#### deleteSelection
| # | 설명 |
|---|------|
| 5 | 범위 내 모든 셀 value: '' → onUpdateCells 호출 |
| 6 | selectionRange === null → 아무 동작 없음 |

#### paste
| # | 설명 |
|---|------|
| 7 | 단일 셀 붙여넣기 → onUpdateCells 1건 |
| 8 | 멀티행 붙여넣기 (TSV) → 여러 셀 변경 |
| 9 | 범위 초과 붙여넣기 → 경계 밖 셀 무시 |
| 10 | selection === null → 아무 동작 없음 |
| 11 | 빈 클립보드 → onUpdateCells 미호출 |

---

### [C] useCsvKeyboard

**Mock 전제**: clipboard 훅을 mock 객체로 전달, setSelection/setEditingCell은 vi.fn()

#### 비활성 조건
| # | 설명 |
|---|------|
| 1 | selection === null → 모든 키 무시 |
| 2 | editingCell !== null → 모든 키 무시 |

#### Arrow 네비게이션
| # | 설명 |
|---|------|
| 3 | ArrowUp → row - 1 (Math.max(0, row-1)) |
| 4 | ArrowDown → row + 1 (Math.min(dataLength-1, row+1)) |
| 5 | ArrowLeft → col - 1 |
| 6 | ArrowRight → col + 1 |
| 7 | 경계 (row=0에서 ArrowUp) → row 유지 |
| 8 | 경계 (마지막 col에서 ArrowRight) → col 유지 |

#### Shift+Arrow (범위 확장)
| # | 설명 |
|---|------|
| 9 | Shift+ArrowDown → anchor 유지, focus.row 증가 |
| 10 | Shift+ArrowRight → anchor 유지, focus.col 증가 |

#### 수정키 단축키
| # | 설명 |
|---|------|
| 11 | Ctrl/Cmd+C → clipboard.copy() + preventDefault |
| 12 | Ctrl/Cmd+X → clipboard.copy() + clipboard.deleteSelection() + preventDefault |
| 13 | Ctrl/Cmd+C (selectionRange === null) → copy 미호출, 아무 동작 없음 |
| 14 | Ctrl/Cmd+V → clipboard.paste() + preventDefault |
| 15 | Ctrl/Cmd+Z → onUndo() + preventDefault |
| 16 | Ctrl/Cmd+Shift+Z → onRedo() + preventDefault |
| 17 | Ctrl/Cmd+Y → onRedo() + preventDefault |

#### 특수 키
| # | 설명 |
|---|------|
| 18 | Enter (단일 선택) → setEditingCell 호출 |
| 19 | Enter (범위 선택) → 아무 동작 없음 |
| 20 | Escape → setSelection(null) |
| 21 | Delete/Backspace → clipboard.deleteSelection() |

#### Tab 네비게이션
| # | 설명 |
|---|------|
| 22 | Tab → 다음 열 이동 |
| 23 | Tab (마지막 열) → 다음 행 첫 열 이동 |
| 24 | Tab (마지막 행 + 마지막 열) → 아무 동작 없음 |
| 25 | Shift+Tab → 이전 열 이동 |
| 26 | Shift+Tab (첫 열) → 이전 행 마지막 열 이동 |
| 27 | Shift+Tab (첫 행 + 첫 열) → 아무 동작 없음 |

---

### [D] useCsvColumnResize

#### handleResizeStart
| # | 설명 |
|---|------|
| 1 | e.preventDefault + e.stopPropagation 호출 |
| 2 | document.addEventListener('mousemove') 등록 |
| 3 | document.addEventListener('mouseup') 등록 |

#### 드래그 중 (mousemove)
| # | 설명 |
|---|------|
| 4 | 오른쪽 드래그 → 너비 증가 (startWidth + diff) |
| 5 | 왼쪽 드래그 → MIN_COL_WIDTH 이하로 축소 불가 |
| 6 | onColumnSizingChange에 updater 함수 전달 |

#### 드래그 종료 (mouseup)
| # | 설명 |
|---|------|
| 7 | mousemove + mouseup 리스너 제거 |
| 8 | 제거 후 mousemove → onColumnSizingChange 미호출 |

---

## 5. 테스트 케이스 수 요약

| 훅 | 테스트 수 |
|----|----------|
| useCsvSelection | 23 |
| useCsvClipboard | 11 |
| useCsvKeyboard | 27 |
| useCsvColumnResize | 8 |
| **합계** | **69** |

---

## 6. 검증

```bash
npm run test:web    # Renderer 테스트
```

---

## 7. 주의사항

- happy-dom에는 `navigator.clipboard`가 없으므로 `Object.defineProperty`로 mock 설정 필요
- `renderHook`의 결과로 반환되는 핸들러에 직접 이벤트 객체를 전달하여 테스트 (DOM 렌더링 불필요)
- `useCsvSelection`의 virtualizer 인자는 `{ scrollToIndex: vi.fn() }` 최소 mock으로 충분
- `useCsvKeyboard`는 clipboard 훅 자체를 mock하지 않고 mock 객체를 인자로 전달 (훅 간 결합 없음)
- `useCsvColumnResize`의 document 리스너는 `vi.spyOn(document, 'addEventListener')`로 캡처 → `spy.mock.calls`에서 `'mousemove'`/`'mouseup'` 콜백 추출 후 직접 호출. `new MouseEvent('mousemove', { clientX: N })`으로 이벤트 생성
- `async/await + act(async () => {...})` 패턴: clipboard.paste()는 `.then()` 기반 비동기이므로 `readText` mock은 반드시 `vi.fn().mockResolvedValue(text)` 사용 + `await act(async () => { result.current.paste() })` 필수
- `useCsvSelection`의 `handleBlur` 테스트 시 FocusEvent mock에 `currentTarget.contains(relatedTarget)` 메서드 포함 필요 — happy-dom DOM 관계 판단이 불완전할 수 있으므로 mock event 객체 사용 권장
- `useCsvColumnResize`의 `onColumnSizingChange`에 전달되는 updater는 함수 `(prev) => ({...})` 형태 — 테스트에서 `mock.calls[0][0]`이 함수인지 확인 후 `updater({ col_0: 100 })` 직접 호출하여 `col_${colIndex}` 키 포맷 및 결과값 검증
