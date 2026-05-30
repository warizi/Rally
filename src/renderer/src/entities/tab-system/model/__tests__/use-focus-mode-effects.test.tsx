/**
 * entities/tab-system/model/use-focus-mode-effects.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  state: {
    focusedTabIds: [] as string[],
    tabs: {} as Record<string, { id: string }>,
    exitFocusMode: vi.fn()
  }
}))

vi.mock('../store', () => ({
  useTabStore: Object.assign((sel: (s: typeof mocks.state) => unknown) => sel(mocks.state), {
    getState: () => mocks.state,
    setState: (updater: (s: typeof mocks.state) => Partial<typeof mocks.state>) => {
      const update = updater(mocks.state)
      Object.assign(mocks.state, update)
    }
  })
}))

import { useFocusModeEffects } from '../use-focus-mode-effects'

beforeEach(() => {
  mocks.state.focusedTabIds = []
  mocks.state.tabs = {}
  mocks.state.exitFocusMode.mockReset()
})

describe('useFocusModeEffects', () => {
  it('스택 비어있음 → ESC 핸들러 미등록', () => {
    renderHook(() => useFocusModeEffects())
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(mocks.state.exitFocusMode).not.toHaveBeenCalled()
  })

  it('focusedTabIds 있음 → ESC 키 → exitFocusMode 호출', () => {
    mocks.state.focusedTabIds = ['t1']
    mocks.state.tabs = { t1: { id: 't1' } }
    renderHook(() => useFocusModeEffects())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(mocks.state.exitFocusMode).toHaveBeenCalled()
  })

  it('다른 키 → exitFocusMode 호출 안 함', () => {
    mocks.state.focusedTabIds = ['t1']
    mocks.state.tabs = { t1: { id: 't1' } }
    renderHook(() => useFocusModeEffects())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
    expect(mocks.state.exitFocusMode).not.toHaveBeenCalled()
  })

  it('focusedTabIds 에 invalid id 포함 → 정리됨', () => {
    mocks.state.focusedTabIds = ['t1', 't-missing']
    mocks.state.tabs = { t1: { id: 't1' } }
    renderHook(() => useFocusModeEffects())
    // hook effect 가 invalid id 제거
    expect(mocks.state.focusedTabIds).toEqual(['t1'])
  })
})
