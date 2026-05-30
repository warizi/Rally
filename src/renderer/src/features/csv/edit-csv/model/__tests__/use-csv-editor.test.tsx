/**
 * features/csv/edit-csv/model/use-csv-editor.test.tsx
 *
 * parseCsv + updateCell + addRow + removeRow + addColumn + removeColumn + undo/redo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@entities/csv-file', () => ({
  useWriteCsvContent: () => ({ mutate: vi.fn() })
}))

import { useCsvEditor } from '../use-csv-editor'

beforeEach(() => {
  vi.useFakeTimers()
})

describe('useCsvEditor', () => {
  it('initialContent parse → headers + data', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2\n3,4'))
    expect(result.current.headers).toEqual(['a', 'b'])
    expect(result.current.data).toEqual([
      ['1', '2'],
      ['3', '4']
    ])
  })

  it('빈 content → headers/data 비어있음', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', ''))
    expect(result.current.headers).toEqual([])
    expect(result.current.data).toEqual([])
  })

  it('updateCell → data 변경', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.updateCell(0, 0, 'X')
    })
    expect(result.current.data[0][0]).toBe('X')
    expect(result.current.canUndo).toBe(true)
  })

  it('addRow → 빈 행 추가', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.addRow()
    })
    expect(result.current.data).toHaveLength(2)
  })

  it('removeRow → 행 삭제', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2\n3,4'))
    act(() => {
      result.current.removeRow(0)
    })
    expect(result.current.data).toEqual([['3', '4']])
  })

  it('addColumn → 헤더 + 각 행에 빈 컬럼 추가', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.addColumn('c')
    })
    expect(result.current.headers).toEqual(['a', 'b', 'c'])
    expect(result.current.data[0]).toHaveLength(3)
  })

  it('removeColumn → 해당 컬럼 삭제', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.removeColumn(1)
    })
    expect(result.current.headers).toEqual(['a'])
    expect(result.current.data[0]).toEqual(['1'])
  })

  it('renameColumn → 헤더 이름 변경', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.renameColumn(0, 'new-name')
    })
    expect(result.current.headers).toEqual(['new-name', 'b'])
  })

  it('undo → 이전 상태 복원 + canRedo=true', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.updateCell(0, 0, 'X')
    })
    expect(result.current.data[0][0]).toBe('X')
    act(() => {
      result.current.undo()
    })
    expect(result.current.data[0][0]).toBe('1')
    expect(result.current.canRedo).toBe(true)
  })

  it('redo → undo 후 다시 적용', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    act(() => {
      result.current.updateCell(0, 0, 'X')
      result.current.undo()
      result.current.redo()
    })
    expect(result.current.data[0][0]).toBe('X')
  })

  it('초기 상태 canUndo=false, canRedo=false', () => {
    const { result } = renderHook(() => useCsvEditor('ws', 'c1', 'a,b\n1,2'))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})
