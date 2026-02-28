import { renderHook, act } from '@testing-library/react'
import type { Selection, SelectionRange } from '../types'
import { useCsvClipboard } from '../use-csv-clipboard'

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue('')
}
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true })

const data = [
  ['a', 'b', 'c'],
  ['d', 'e', 'f'],
  ['g', 'h', 'i']
]
const headers = ['Col1', 'Col2', 'Col3']

let onUpdateCells: ReturnType<typeof vi.fn>

function setup(selection: Selection | null, selectionRange: SelectionRange | null) {
  onUpdateCells = vi.fn()
  return renderHook(() => useCsvClipboard(selection, selectionRange, data, headers, onUpdateCells))
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── copy ────────────────────────────────────────────────

describe('copy', () => {
  it('1 — 단일 셀 복사 → clipboard.writeText("a")', () => {
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    const range: SelectionRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }
    const { result } = setup(sel, range)
    act(() => result.current.copy())
    expect(mockClipboard.writeText).toHaveBeenCalledWith('a')
  })

  it('2 — 범위 복사 (2x2) → clipboard.writeText("a\\tb\\nd\\te")', () => {
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 1, col: 1 } }
    const range: SelectionRange = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }
    const { result } = setup(sel, range)
    act(() => result.current.copy())
    expect(mockClipboard.writeText).toHaveBeenCalledWith('a\tb\nd\te')
  })

  it('3 — selectionRange === null → 아무 동작 없음', () => {
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    const { result } = setup(sel, null)
    act(() => result.current.copy())
    expect(mockClipboard.writeText).not.toHaveBeenCalled()
  })
})

// ─── cut ─────────────────────────────────────────────────

describe('cut', () => {
  it('4 — 복사 후 셀 클리어 → writeText + onUpdateCells(value: "") 호출', () => {
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 1 } }
    const range: SelectionRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 1 }
    const { result } = setup(sel, range)
    act(() => result.current.cut())
    expect(mockClipboard.writeText).toHaveBeenCalledWith('a\tb')
    expect(onUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: '' },
      { row: 0, col: 1, value: '' }
    ])
  })
})

// ─── deleteSelection ─────────────────────────────────────

describe('deleteSelection', () => {
  it('5 — 범위 내 모든 셀 value: "" → onUpdateCells 호출', () => {
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 1, col: 1 } }
    const range: SelectionRange = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }
    const { result } = setup(sel, range)
    act(() => result.current.deleteSelection())
    expect(onUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: '' },
      { row: 0, col: 1, value: '' },
      { row: 1, col: 0, value: '' },
      { row: 1, col: 1, value: '' }
    ])
  })

  it('6 — selectionRange === null → 아무 동작 없음', () => {
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    const { result } = setup(sel, null)
    act(() => result.current.deleteSelection())
    expect(onUpdateCells).not.toHaveBeenCalled()
  })
})

// ─── paste ───────────────────────────────────────────────

describe('paste', () => {
  it('7 — 단일 셀 붙여넣기 → onUpdateCells 1건', async () => {
    mockClipboard.readText.mockResolvedValue('z')
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    const range: SelectionRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }
    const { result } = setup(sel, range)
    await act(async () => result.current.paste())
    expect(onUpdateCells).toHaveBeenCalledWith([{ row: 0, col: 0, value: 'z' }])
  })

  it('8 — 멀티행 붙여넣기 (TSV) → 여러 셀 변경', async () => {
    mockClipboard.readText.mockResolvedValue('x\ty\nw\tv')
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    const range: SelectionRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }
    const { result } = setup(sel, range)
    await act(async () => result.current.paste())
    expect(onUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: 'x' },
      { row: 0, col: 1, value: 'y' },
      { row: 1, col: 0, value: 'w' },
      { row: 1, col: 1, value: 'v' }
    ])
  })

  it('9 — 범위 초과 붙여넣기 → 경계 밖 셀 무시', async () => {
    mockClipboard.readText.mockResolvedValue('1\t2\t3\t4')
    const sel: Selection = { anchor: { row: 0, col: 1 }, focus: { row: 0, col: 1 } }
    const range: SelectionRange = { startRow: 0, endRow: 0, startCol: 1, endCol: 1 }
    const { result } = setup(sel, range)
    await act(async () => result.current.paste())
    // col 1+0=1, 1+1=2 are valid (headers.length=3), 1+2=3 is out of bounds
    expect(onUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 1, value: '1' },
      { row: 0, col: 2, value: '2' }
    ])
  })

  it('10 — selection === null → 아무 동작 없음', async () => {
    mockClipboard.readText.mockResolvedValue('z')
    const { result } = setup(null, null)
    await act(async () => result.current.paste())
    expect(mockClipboard.readText).not.toHaveBeenCalled()
    expect(onUpdateCells).not.toHaveBeenCalled()
  })

  it('11 — 빈 클립보드 → onUpdateCells 미호출', async () => {
    mockClipboard.readText.mockResolvedValue('')
    const sel: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
    const range: SelectionRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }
    const { result } = setup(sel, range)
    await act(async () => result.current.paste())
    expect(onUpdateCells).not.toHaveBeenCalled()
  })
})
