import { renderHook, act } from '@testing-library/react'
import type { Virtualizer } from '@tanstack/react-virtual'
import { useCsvSelection } from '../use-csv-selection'

const mockRowVirtualizer = { scrollToIndex: vi.fn() } as unknown as Virtualizer<
  HTMLDivElement,
  Element
>
const mockColVirtualizer = { scrollToIndex: vi.fn() } as unknown as Virtualizer<
  HTMLDivElement,
  Element
>
const mockScrollRef = { current: { focus: vi.fn() } as unknown as HTMLDivElement }

function setup() {
  return renderHook(() =>
    useCsvSelection(
      mockScrollRef as React.RefObject<HTMLDivElement | null>,
      mockRowVirtualizer,
      mockColVirtualizer
    )
  )
}

function mouseEvent(opts: Partial<React.MouseEvent> = {}): React.MouseEvent {
  return { button: 0, shiftKey: false, ...opts } as unknown as React.MouseEvent
}

function blurEvent(
  contains: boolean,
  contextMenuOpen = false
): React.FocusEvent<HTMLDivElement> {
  return {
    currentTarget: { contains: () => contains },
    relatedTarget: {}
  } as unknown as React.FocusEvent<HTMLDivElement>
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 초기 상태 ────────────────────────────────────────────

describe('초기 상태', () => {
  it('1 — selection === null', () => {
    const { result } = setup()
    expect(result.current.selection).toBeNull()
  })

  it('2 — editingCell === null', () => {
    const { result } = setup()
    expect(result.current.editingCell).toBeNull()
  })

  it('3 — selectionRange === null', () => {
    const { result } = setup()
    expect(result.current.selectionRange).toBeNull()
  })

  it('4 — isSingleSelection === false', () => {
    const { result } = setup()
    expect(result.current.isSingleSelection).toBe(false)
  })
})

// ─── handleCellMouseDown ──────────────────────────────────

describe('handleCellMouseDown', () => {
  it('5 — 좌클릭 → selection 설정 (anchor === focus)', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(2, 3, mouseEvent()))
    expect(result.current.selection).toEqual({
      anchor: { row: 2, col: 3 },
      focus: { row: 2, col: 3 }
    })
  })

  it('6 — button !== 0 → 무시', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(1, 1, mouseEvent({ button: 2 })))
    expect(result.current.selection).toBeNull()
  })

  it('7 — Shift+클릭 → anchor 유지, focus 변경', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    act(() =>
      result.current.handleCellMouseDown(2, 3, mouseEvent({ shiftKey: true }))
    )
    expect(result.current.selection).toEqual({
      anchor: { row: 0, col: 0 },
      focus: { row: 2, col: 3 }
    })
  })

  it('8 — 클릭 시 editingCell 초기화', () => {
    const { result } = setup()
    act(() => result.current.handleCellStartEdit(1, 1))
    expect(result.current.editingCell).toEqual({ row: 1, col: 1 })
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    expect(result.current.editingCell).toBeNull()
  })

  it('9 — 클릭 시 scrollRef.focus() 호출', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    expect(mockScrollRef.current.focus).toHaveBeenCalled()
  })
})

// ─── selectionRange 계산 ──────────────────────────────────

describe('selectionRange 계산', () => {
  it('10 — anchor < focus → startRow/startCol = anchor, endRow/endCol = focus', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    act(() =>
      result.current.handleCellMouseDown(2, 3, mouseEvent({ shiftKey: true }))
    )
    expect(result.current.selectionRange).toEqual({
      startRow: 0,
      endRow: 2,
      startCol: 0,
      endCol: 3
    })
  })

  it('11 — anchor > focus (역방향) → startRow/startCol = focus, endRow/endCol = anchor', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(3, 4, mouseEvent()))
    act(() =>
      result.current.handleCellMouseDown(1, 2, mouseEvent({ shiftKey: true }))
    )
    expect(result.current.selectionRange).toEqual({
      startRow: 1,
      endRow: 3,
      startCol: 2,
      endCol: 4
    })
  })
})

// ─── isSingleSelection ───────────────────────────────────

describe('isSingleSelection', () => {
  it('12 — anchor === focus → true', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(1, 1, mouseEvent()))
    expect(result.current.isSingleSelection).toBe(true)
  })

  it('13 — anchor !== focus → false', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    act(() =>
      result.current.handleCellMouseDown(1, 1, mouseEvent({ shiftKey: true }))
    )
    expect(result.current.isSingleSelection).toBe(false)
  })
})

// ─── 드래그 ──────────────────────────────────────────────

describe('드래그 (Mouse Enter / Up)', () => {
  it('14 — mouseDown 후 mouseEnter → focus 업데이트', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    act(() => result.current.handleCellMouseEnter(2, 3))
    expect(result.current.selection?.focus).toEqual({ row: 2, col: 3 })
    expect(result.current.selection?.anchor).toEqual({ row: 0, col: 0 })
  })

  it('15 — mouseUp 후 mouseEnter → 변화 없음', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 0, mouseEvent()))
    act(() => result.current.handleMouseUp())
    act(() => result.current.handleCellMouseEnter(2, 3))
    expect(result.current.selection?.focus).toEqual({ row: 0, col: 0 })
  })
})

// ─── 편집 모드 ───────────────────────────────────────────

describe('편집 모드', () => {
  it('16 — handleCellStartEdit → selection + editingCell 설정', () => {
    const { result } = setup()
    act(() => result.current.handleCellStartEdit(2, 1))
    expect(result.current.selection).toEqual({
      anchor: { row: 2, col: 1 },
      focus: { row: 2, col: 1 }
    })
    expect(result.current.editingCell).toEqual({ row: 2, col: 1 })
  })

  it('17 — handleStopEdit → editingCell === null', () => {
    const { result } = setup()
    act(() => result.current.handleCellStartEdit(1, 1))
    act(() => result.current.handleStopEdit())
    expect(result.current.editingCell).toBeNull()
  })

  it('18 — 편집 종료 후 scrollRef.focus() 호출', () => {
    const { result } = setup()
    act(() => result.current.handleCellStartEdit(1, 1))
    vi.clearAllMocks()
    act(() => result.current.handleStopEdit())
    expect(mockScrollRef.current.focus).toHaveBeenCalled()
  })
})

// ─── Blur ────────────────────────────────────────────────

describe('Blur', () => {
  it('19 — 외부로 포커스 이동 → selection + editingCell 초기화', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(1, 1, mouseEvent()))
    act(() => result.current.handleBlur(blurEvent(false)))
    expect(result.current.selection).toBeNull()
    expect(result.current.editingCell).toBeNull()
  })

  it('20 — 컨테이너 내부 포커스 이동 → 유지', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(1, 1, mouseEvent()))
    act(() => result.current.handleBlur(blurEvent(true)))
    expect(result.current.selection).not.toBeNull()
  })

  it('21 — contextMenuOpenRef === true → 유지', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(1, 1, mouseEvent()))
    result.current.contextMenuOpenRef.current = true
    act(() => result.current.handleBlur(blurEvent(false)))
    expect(result.current.selection).not.toBeNull()
    result.current.contextMenuOpenRef.current = false
  })
})

// ─── Virtualizer 연동 ────────────────────────────────────

describe('Virtualizer 연동', () => {
  it('22 — focus.row 변경 시 rowVirtualizer.scrollToIndex 호출', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(3, 0, mouseEvent()))
    expect(mockRowVirtualizer.scrollToIndex).toHaveBeenCalledWith(3, { align: 'auto' })
  })

  it('23 — focus.col 변경 시 colVirtualizer.scrollToIndex 호출', () => {
    const { result } = setup()
    act(() => result.current.handleCellMouseDown(0, 5, mouseEvent()))
    expect(mockColVirtualizer.scrollToIndex).toHaveBeenCalledWith(5, { align: 'auto' })
  })
})
