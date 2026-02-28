import { renderHook } from '@testing-library/react'
import type { Selection, SelectionRange, CellPos } from '../types'
import type { UseCsvClipboardReturn } from '../use-csv-clipboard'
import { useCsvKeyboard } from '../use-csv-keyboard'

function createKeyEvent(
  key: string,
  opts?: Partial<React.KeyboardEvent>
): React.KeyboardEvent<HTMLDivElement> {
  return {
    key,
    preventDefault: vi.fn(),
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...opts
  } as unknown as React.KeyboardEvent<HTMLDivElement>
}

const DATA_LENGTH = 5
const HEADERS_LENGTH = 4

function createClipboardMock(): UseCsvClipboardReturn {
  return {
    copy: vi.fn(),
    cut: vi.fn(),
    paste: vi.fn(),
    deleteSelection: vi.fn()
  }
}

interface SetupOpts {
  selection?: Selection | null
  selectionRange?: SelectionRange | null
  isSingleSelection?: boolean
  editingCell?: CellPos | null
}

function setup(opts: SetupOpts = {}) {
  const {
    selection = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } },
    selectionRange = { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
    isSingleSelection = true,
    editingCell = null
  } = opts

  const setSelection = vi.fn()
  const setEditingCell = vi.fn()
  const clipboard = createClipboardMock()
  const onUndo = vi.fn()
  const onRedo = vi.fn()

  const { result } = renderHook(() =>
    useCsvKeyboard(
      selection,
      selectionRange,
      isSingleSelection,
      editingCell,
      setSelection,
      setEditingCell,
      clipboard,
      DATA_LENGTH,
      HEADERS_LENGTH,
      onUndo,
      onRedo
    )
  )

  return { result, setSelection, setEditingCell, clipboard, onUndo, onRedo }
}

// ─── 비활성 조건 ─────────────────────────────────────────

describe('비활성 조건', () => {
  it('1 — selection === null → 모든 키 무시', () => {
    const { result, setSelection } = setup({ selection: null, selectionRange: null })
    const e = createKeyEvent('ArrowUp')
    result.current.handleKeyDown(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(setSelection).not.toHaveBeenCalled()
  })

  it('2 — editingCell !== null → 모든 키 무시', () => {
    const { result, setSelection } = setup({ editingCell: { row: 1, col: 1 } })
    const e = createKeyEvent('ArrowUp')
    result.current.handleKeyDown(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(setSelection).not.toHaveBeenCalled()
  })
})

// ─── Arrow 네비게이션 ────────────────────────────────────

describe('Arrow 네비게이션', () => {
  it('3 — ArrowUp → row - 1', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 2, col: 1 }, focus: { row: 2, col: 1 } }
    })
    const e = createKeyEvent('ArrowUp')
    result.current.handleKeyDown(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 1, col: 1 },
      focus: { row: 1, col: 1 }
    })
  })

  it('4 — ArrowDown → row + 1', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 2, col: 1 }, focus: { row: 2, col: 1 } }
    })
    const e = createKeyEvent('ArrowDown')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 3, col: 1 },
      focus: { row: 3, col: 1 }
    })
  })

  it('5 — ArrowLeft → col - 1', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 1, col: 2 }, focus: { row: 1, col: 2 } }
    })
    const e = createKeyEvent('ArrowLeft')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 1, col: 1 },
      focus: { row: 1, col: 1 }
    })
  })

  it('6 — ArrowRight → col + 1', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }
    })
    const e = createKeyEvent('ArrowRight')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 1, col: 2 },
      focus: { row: 1, col: 2 }
    })
  })

  it('7 — 경계 (row=0에서 ArrowUp) → row 유지', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    })
    const e = createKeyEvent('ArrowUp')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 0, col: 0 },
      focus: { row: 0, col: 0 }
    })
  })

  it('8 — 경계 (마지막 col에서 ArrowRight) → col 유지', () => {
    const lastCol = HEADERS_LENGTH - 1
    const { result, setSelection } = setup({
      selection: { anchor: { row: 0, col: lastCol }, focus: { row: 0, col: lastCol } }
    })
    const e = createKeyEvent('ArrowRight')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 0, col: lastCol },
      focus: { row: 0, col: lastCol }
    })
  })
})

// ─── Shift+Arrow ─────────────────────────────────────────

describe('Shift+Arrow (범위 확장)', () => {
  it('9 — Shift+ArrowDown → anchor 유지, focus.row 증가', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }
    })
    const e = createKeyEvent('ArrowDown', { shiftKey: true })
    result.current.handleKeyDown(e)
    // setSelection receives an updater function
    const updater = setSelection.mock.calls[0][0]
    const prev = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }
    const next = typeof updater === 'function' ? updater(prev) : updater
    expect(next).toEqual({ anchor: { row: 1, col: 1 }, focus: { row: 2, col: 1 } })
  })

  it('10 — Shift+ArrowRight → anchor 유지, focus.col 증가', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }
    })
    const e = createKeyEvent('ArrowRight', { shiftKey: true })
    result.current.handleKeyDown(e)
    const updater = setSelection.mock.calls[0][0]
    const prev = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }
    const next = typeof updater === 'function' ? updater(prev) : updater
    expect(next).toEqual({ anchor: { row: 1, col: 1 }, focus: { row: 1, col: 2 } })
  })
})

// ─── 수정키 단축키 ──────────────────────────────────────

describe('수정키 단축키', () => {
  it('11 — Ctrl/Cmd+C → clipboard.copy() + preventDefault', () => {
    const { result, clipboard } = setup()
    const e = createKeyEvent('c', { metaKey: true })
    result.current.handleKeyDown(e)
    expect(clipboard.copy).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('12 — Ctrl/Cmd+X → clipboard.copy() + clipboard.deleteSelection() + preventDefault', () => {
    const { result, clipboard } = setup()
    const e = createKeyEvent('x', { metaKey: true })
    result.current.handleKeyDown(e)
    expect(clipboard.copy).toHaveBeenCalled()
    expect(clipboard.deleteSelection).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('13 — Ctrl/Cmd+C (selectionRange === null) → copy 미호출', () => {
    const { result, clipboard } = setup({ selectionRange: null })
    const e = createKeyEvent('c', { metaKey: true })
    result.current.handleKeyDown(e)
    expect(clipboard.copy).not.toHaveBeenCalled()
  })

  it('14 — Ctrl/Cmd+V → clipboard.paste() + preventDefault', () => {
    const { result, clipboard } = setup()
    const e = createKeyEvent('v', { metaKey: true })
    result.current.handleKeyDown(e)
    expect(clipboard.paste).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('15 — Ctrl/Cmd+Z → onUndo() + preventDefault', () => {
    const { result, onUndo } = setup()
    const e = createKeyEvent('z', { metaKey: true })
    result.current.handleKeyDown(e)
    expect(onUndo).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('16 — Ctrl/Cmd+Shift+Z → onRedo() + preventDefault', () => {
    const { result, onRedo } = setup()
    const e = createKeyEvent('z', { metaKey: true, shiftKey: true })
    result.current.handleKeyDown(e)
    expect(onRedo).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('17 — Ctrl/Cmd+Y → onRedo() + preventDefault', () => {
    const { result, onRedo } = setup()
    const e = createKeyEvent('y', { metaKey: true })
    result.current.handleKeyDown(e)
    expect(onRedo).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })
})

// ─── 특수 키 ─────────────────────────────────────────────

describe('특수 키', () => {
  it('18 — Enter (단일 선택) → setEditingCell 호출', () => {
    const { result, setEditingCell } = setup({ isSingleSelection: true })
    const e = createKeyEvent('Enter')
    result.current.handleKeyDown(e)
    expect(setEditingCell).toHaveBeenCalledWith({ row: 1, col: 1 })
  })

  it('19 — Enter (범위 선택) → 아무 동작 없음', () => {
    const { result, setEditingCell } = setup({ isSingleSelection: false })
    const e = createKeyEvent('Enter')
    result.current.handleKeyDown(e)
    expect(setEditingCell).not.toHaveBeenCalled()
  })

  it('20 — Escape → setSelection(null)', () => {
    const { result, setSelection } = setup()
    const e = createKeyEvent('Escape')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith(null)
  })

  it('21 — Delete/Backspace → clipboard.deleteSelection()', () => {
    const { result, clipboard } = setup()
    const e = createKeyEvent('Delete')
    result.current.handleKeyDown(e)
    expect(clipboard.deleteSelection).toHaveBeenCalled()

    vi.clearAllMocks()
    const e2 = createKeyEvent('Backspace')
    result.current.handleKeyDown(e2)
    expect(clipboard.deleteSelection).toHaveBeenCalled()
  })
})

// ─── Tab 네비게이션 ──────────────────────────────────────

describe('Tab 네비게이션', () => {
  it('22 — Tab → 다음 열 이동', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    })
    const e = createKeyEvent('Tab')
    result.current.handleKeyDown(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 0, col: 1 },
      focus: { row: 0, col: 1 }
    })
  })

  it('23 — Tab (마지막 열) → 다음 행 첫 열 이동', () => {
    const lastCol = HEADERS_LENGTH - 1
    const { result, setSelection } = setup({
      selection: { anchor: { row: 0, col: lastCol }, focus: { row: 0, col: lastCol } }
    })
    const e = createKeyEvent('Tab')
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 1, col: 0 },
      focus: { row: 1, col: 0 }
    })
  })

  it('24 — Tab (마지막 행 + 마지막 열) → 아무 동작 없음', () => {
    const lastRow = DATA_LENGTH - 1
    const lastCol = HEADERS_LENGTH - 1
    const { result, setSelection } = setup({
      selection: {
        anchor: { row: lastRow, col: lastCol },
        focus: { row: lastRow, col: lastCol }
      }
    })
    const e = createKeyEvent('Tab')
    result.current.handleKeyDown(e)
    expect(setSelection).not.toHaveBeenCalled()
  })

  it('25 — Shift+Tab → 이전 열 이동', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 1, col: 2 }, focus: { row: 1, col: 2 } }
    })
    const e = createKeyEvent('Tab', { shiftKey: true })
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 1, col: 1 },
      focus: { row: 1, col: 1 }
    })
  })

  it('26 — Shift+Tab (첫 열) → 이전 행 마지막 열 이동', () => {
    const lastCol = HEADERS_LENGTH - 1
    const { result, setSelection } = setup({
      selection: { anchor: { row: 1, col: 0 }, focus: { row: 1, col: 0 } }
    })
    const e = createKeyEvent('Tab', { shiftKey: true })
    result.current.handleKeyDown(e)
    expect(setSelection).toHaveBeenCalledWith({
      anchor: { row: 0, col: lastCol },
      focus: { row: 0, col: lastCol }
    })
  })

  it('27 — Shift+Tab (첫 행 + 첫 열) → 아무 동작 없음', () => {
    const { result, setSelection } = setup({
      selection: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    })
    const e = createKeyEvent('Tab', { shiftKey: true })
    result.current.handleKeyDown(e)
    expect(setSelection).not.toHaveBeenCalled()
  })
})
