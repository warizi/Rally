/**
 * features/csv/edit-csv/model/use-csv-external-sync.test.ts
 *
 * CSV_EXTERNAL_CHANGED_EVENT custom event 구독. csvId 일치 시만 콜백 호출.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { CSV_EXTERNAL_CHANGED_EVENT } from '@entities/csv-file'
import { useCsvExternalSync } from '../use-csv-external-sync'

function fire(csvId: string): void {
  window.dispatchEvent(new CustomEvent(CSV_EXTERNAL_CHANGED_EVENT, { detail: { csvId } }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCsvExternalSync', () => {
  it('일치하는 csvId 이벤트 → 콜백 호출', () => {
    const cb = vi.fn()
    renderHook(() => useCsvExternalSync('csv-1', cb))
    fire('csv-1')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('다른 csvId 이벤트 → 콜백 호출 안 함', () => {
    const cb = vi.fn()
    renderHook(() => useCsvExternalSync('csv-1', cb))
    fire('csv-OTHER')
    expect(cb).not.toHaveBeenCalled()
  })

  it('detail 없는 이벤트 → 콜백 호출 안 함', () => {
    const cb = vi.fn()
    renderHook(() => useCsvExternalSync('csv-1', cb))
    window.dispatchEvent(new CustomEvent(CSV_EXTERNAL_CHANGED_EVENT))
    expect(cb).not.toHaveBeenCalled()
  })

  it('unmount → 리스너 제거 (이후 이벤트는 콜백 호출 안 함)', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useCsvExternalSync('csv-1', cb))
    unmount()
    fire('csv-1')
    expect(cb).not.toHaveBeenCalled()
  })
})
