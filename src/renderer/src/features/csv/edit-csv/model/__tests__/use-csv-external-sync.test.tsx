/**
 * features/csv/edit-csv/model/use-csv-external-sync.test.tsx
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@entities/csv-file', () => ({
  CSV_EXTERNAL_CHANGED_EVENT: 'csv-external-changed'
}))

import { useCsvExternalSync } from '../use-csv-external-sync'

describe('useCsvExternalSync', () => {
  it('매칭 csvId 이벤트 → onExternalChange 호출', () => {
    const onChange = vi.fn()
    renderHook(() => useCsvExternalSync('c1', onChange))
    act(() => {
      window.dispatchEvent(new CustomEvent('csv-external-changed', { detail: { csvId: 'c1' } }))
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('다른 csvId 이벤트 → 호출 안 함', () => {
    const onChange = vi.fn()
    renderHook(() => useCsvExternalSync('c1', onChange))
    act(() => {
      window.dispatchEvent(new CustomEvent('csv-external-changed', { detail: { csvId: 'other' } }))
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('언마운트 → listener 정리', () => {
    const onChange = vi.fn()
    const { unmount } = renderHook(() => useCsvExternalSync('c1', onChange))
    unmount()
    act(() => {
      window.dispatchEvent(new CustomEvent('csv-external-changed', { detail: { csvId: 'c1' } }))
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})
