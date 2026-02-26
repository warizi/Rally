import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTreeOpenState } from '../use-tree-open-state'

const KEY = (wsId: string): string => `folder-tree-open-state-${wsId}`

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// ─── 초기 상태 ────────────────────────────────────────────────
describe('초기 상태', () => {
  it('localStorage에 값이 없으면 openState = {} 를 반환한다', () => {
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    expect(result.current.openState).toEqual({})
  })

  it('localStorage에 저장된 값이 있으면 파싱하여 반환한다', () => {
    localStorage.setItem(KEY('ws-1'), JSON.stringify({ f1: true, f2: false }))
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    expect(result.current.openState).toEqual({ f1: true, f2: false })
  })

  it('localStorage.getItem이 throw하면 {} 를 반환한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage error')
    })
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    expect(result.current.openState).toEqual({})
  })

  it('localStorage에 malformed JSON이 저장된 경우 {} 를 반환한다', () => {
    localStorage.setItem(KEY('ws-1'), 'not-valid-json')
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    expect(result.current.openState).toEqual({})
  })
})

// ─── toggle ───────────────────────────────────────────────────
describe('toggle', () => {
  it('toggle(id, true) 후 openState[id] === true 가 된다', () => {
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    act(() => {
      result.current.toggle('f1', true)
    })
    expect(result.current.openState['f1']).toBe(true)
  })

  it('toggle(id, false) 후 openState[id] === false 가 된다', () => {
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    act(() => {
      result.current.toggle('f1', false)
    })
    expect(result.current.openState['f1']).toBe(false)
  })

  it('toggle 후 localStorage.setItem이 호출된다', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem')
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    act(() => {
      result.current.toggle('f1', true)
    })
    expect(setItemSpy).toHaveBeenCalledWith(KEY('ws-1'), JSON.stringify({ f1: true }))
  })

  it('localStorage.setItem이 throw해도 에러 없이 처리된다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useTreeOpenState('ws-1'))
    expect(() => {
      act(() => {
        result.current.toggle('f1', true)
      })
    }).not.toThrow()
  })
})

// ─── localStorage key 형식 ────────────────────────────────────
describe('localStorage key 형식', () => {
  it('folder-tree-open-state-{workspaceId} 형식으로 저장된다', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem')
    const { result } = renderHook(() => useTreeOpenState('ws-42'))
    act(() => {
      result.current.toggle('f1', true)
    })
    expect(setItemSpy).toHaveBeenCalledWith('folder-tree-open-state-ws-42', expect.any(String))
  })

  it('ws-1과 ws-2는 독립적인 key를 사용한다', () => {
    localStorage.setItem(KEY('ws-1'), JSON.stringify({ f1: true }))
    localStorage.setItem(KEY('ws-2'), JSON.stringify({ f2: false }))

    const { result: r1 } = renderHook(() => useTreeOpenState('ws-1'))
    const { result: r2 } = renderHook(() => useTreeOpenState('ws-2'))

    expect(r1.current.openState).toEqual({ f1: true })
    expect(r2.current.openState).toEqual({ f2: false })
  })
})
