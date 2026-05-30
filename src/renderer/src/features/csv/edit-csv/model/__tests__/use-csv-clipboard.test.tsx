/**
 * features/csv/edit-csv/model/use-csv-clipboard.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCsvClipboard } from '../use-csv-clipboard'

const data = [
  ['a1', 'b1', 'c1'],
  ['a2', 'b2', 'c2']
]
const headers = ['A', 'B', 'C']

let writeTextMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeTextMock = vi.fn()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock, readText: vi.fn() },
    configurable: true,
    writable: true
  })
})

describe('useCsvClipboard', () => {
  it('selection 없음 → copy 호출해도 클립보드 무변화', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCsvClipboard(null, null, data, headers, onUpdate))
    act(() => {
      result.current.copy()
    })
    expect(writeTextMock).not.toHaveBeenCalled()
  })

  it('selectionRange 있음 → copy → 클립보드에 TSV 쓰기', () => {
    const selectionRange = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useCsvClipboard(null, selectionRange, data, headers, onUpdate)
    )
    act(() => {
      result.current.copy()
    })
    expect(writeTextMock).toHaveBeenCalledWith('a1\tb1\na2\tb2')
  })

  it('deleteSelection → onUpdateCells 호출 with 빈 값', () => {
    const selectionRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 1 }
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useCsvClipboard(null, selectionRange, data, headers, onUpdate)
    )
    act(() => {
      result.current.deleteSelection()
    })
    expect(onUpdate).toHaveBeenCalledWith([
      { row: 0, col: 0, value: '' },
      { row: 0, col: 1, value: '' }
    ])
  })

  it('selectionRange 없음 → deleteSelection no-op', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCsvClipboard(null, null, data, headers, onUpdate))
    act(() => {
      result.current.deleteSelection()
    })
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
