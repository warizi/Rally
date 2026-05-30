/**
 * entities/tab-system/model/store.test.ts
 */
import { describe, it, expect } from 'vitest'
import { useTabStore } from '../store'

describe('useTabStore', () => {
  it('초기 상태 (createInitialState) — tabs, panes, layout 정의됨', () => {
    const state = useTabStore.getState()
    expect(state.tabs).toBeDefined()
    expect(state.panes).toBeDefined()
    expect(state.layout).toBeDefined()
  })

  it('action 함수들 존재', () => {
    const state = useTabStore.getState()
    expect(typeof state.openTab).toBe('function')
    expect(typeof state.closeTab).toBe('function')
    expect(typeof state.reset).toBe('function')
  })

  it('selector helper 함수들', () => {
    const state = useTabStore.getState()
    expect(typeof state.getTabById).toBe('function')
    expect(typeof state.getPaneById).toBe('function')
    expect(typeof state.findTabByPathname).toBe('function')
  })

  it('reset → 초기 상태로 복귀 (tabs key 셋 유지)', () => {
    const beforeKeys = Object.keys(useTabStore.getState().tabs).sort()
    useTabStore.getState().reset()
    expect(Object.keys(useTabStore.getState().tabs).sort()).toEqual(beforeKeys)
  })

  it('getTabById — 존재 안하는 id → undefined', () => {
    expect(useTabStore.getState().getTabById('non-existent')).toBeUndefined()
  })

  it('findTabByPathname — 존재 안 함 → null/undefined', () => {
    const result = useTabStore.getState().findTabByPathname('/non-existent')
    expect(result == null).toBe(true)
  })
})
