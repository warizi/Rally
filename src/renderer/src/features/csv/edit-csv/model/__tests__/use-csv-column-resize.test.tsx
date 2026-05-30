/**
 * features/csv/edit-csv/model/use-csv-column-resize.test.tsx
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCsvColumnResize } from '../use-csv-column-resize'

describe('useCsvColumnResize', () => {
  it('handleResizeStart → mousemove 시 onColumnSizingChange 호출', () => {
    const getColWidth = vi.fn(() => 100)
    const onSizing = vi.fn()
    const { result } = renderHook(() => useCsvColumnResize(getColWidth, onSizing))

    const fakeEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 50
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleResizeStart(0, fakeEvent)
    })
    expect(fakeEvent.preventDefault).toHaveBeenCalled()
    expect(fakeEvent.stopPropagation).toHaveBeenCalled()

    // mousemove → onColumnSizingChange 호출
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }))
    })
    expect(onSizing).toHaveBeenCalled()
    const updater = onSizing.mock.calls[0][0]
    expect(updater({})).toEqual({ col_0: 150 }) // 100 + 50
  })

  it('mouseup → listener 정리', () => {
    const getColWidth = vi.fn(() => 100)
    const onSizing = vi.fn()
    const { result } = renderHook(() => useCsvColumnResize(getColWidth, onSizing))

    const fakeEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 0
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleResizeStart(0, fakeEvent)
    })
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })
    // 정리됐는지 — mousemove 후 호출 안 됨
    const callsBefore = onSizing.mock.calls.length
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }))
    })
    expect(onSizing.mock.calls.length).toBe(callsBefore)
  })

  it('MIN_COL_WIDTH 이하로 작아져도 최소값 유지', () => {
    const getColWidth = vi.fn(() => 50)
    const onSizing = vi.fn()
    const { result } = renderHook(() => useCsvColumnResize(getColWidth, onSizing))

    const fakeEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleResizeStart(0, fakeEvent)
    })
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
    })
    // diff=-100, startWidth=50 → 결과 음수면 안 됨. Math.max(MIN_COL_WIDTH, ...)
    const updater = onSizing.mock.calls[0][0]
    const result2 = updater({})
    expect(result2.col_0).toBeGreaterThanOrEqual(50) // MIN_COL_WIDTH=50 or 비슷
  })
})
