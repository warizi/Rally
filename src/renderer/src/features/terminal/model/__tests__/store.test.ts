/**
 * features/terminal/model/store.test.ts
 *
 * Terminal store — addSession 시 첫 세션이 active 로 + leaf layout 자동 설정,
 * removeSession 시 active 가 마지막 남은 세션으로 폴백, reset 검증.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '../store'
import type { TerminalSession } from '../types'

function makeSession(id: string): TerminalSession {
  return {
    id,
    name: `s${id}`,
    cwd: '/tmp',
    shell: 'zsh',
    rows: 24,
    cols: 80,
    screenSnapshot: null,
    sortOrder: 0
  } as unknown as TerminalSession
}

beforeEach(() => {
  useTerminalStore.getState().reset()
})

describe('addSession', () => {
  it('첫 세션 → activeSessionId 자동 설정 + leaf layout', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    const s = useTerminalStore.getState()
    expect(Object.keys(s.sessions)).toEqual(['a'])
    expect(s.activeSessionId).toBe('a')
    expect(s.layout).toEqual({ type: 'leaf', sessionId: 'a' })
  })

  it('두번째 세션 → active 와 layout 은 변경 안 됨', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    useTerminalStore.getState().addSession(makeSession('b'))
    const s = useTerminalStore.getState()
    expect(s.activeSessionId).toBe('a')
    expect(s.layout).toEqual({ type: 'leaf', sessionId: 'a' })
    expect(Object.keys(s.sessions)).toEqual(['a', 'b'])
  })
})

describe('removeSession', () => {
  it('active 세션 제거 → 남은 마지막 세션이 active', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    useTerminalStore.getState().addSession(makeSession('b'))
    useTerminalStore.getState().addSession(makeSession('c'))
    useTerminalStore.getState().setActiveSession('b')
    useTerminalStore.getState().removeSession('b')
    expect(useTerminalStore.getState().activeSessionId).toBe('c')
  })

  it('비 active 세션 제거 → active 유지', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    useTerminalStore.getState().addSession(makeSession('b'))
    useTerminalStore.getState().setActiveSession('a')
    useTerminalStore.getState().removeSession('b')
    expect(useTerminalStore.getState().activeSessionId).toBe('a')
  })

  it('모든 세션 제거 → activeSessionId=null', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    useTerminalStore.getState().removeSession('a')
    expect(useTerminalStore.getState().activeSessionId).toBe(null)
    expect(useTerminalStore.getState().sessions).toEqual({})
  })
})

describe('updateSession / setActiveSession / setLayout / reset', () => {
  it('updateSession 부분 patch', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    useTerminalStore.getState().updateSession('a', { rows: 50 })
    expect(useTerminalStore.getState().sessions['a'].rows).toBe(50)
    expect(useTerminalStore.getState().sessions['a'].cols).toBe(80) // 다른 필드 유지
  })

  it('setLayout 그대로 저장', () => {
    useTerminalStore.getState().setLayout({ type: 'leaf', sessionId: 'x' } as never)
    expect(useTerminalStore.getState().layout).toEqual({ type: 'leaf', sessionId: 'x' })
  })

  it('reset → 모든 필드 initialState 로', () => {
    useTerminalStore.getState().addSession(makeSession('a'))
    useTerminalStore.getState().setActiveSession('a')
    useTerminalStore.getState().reset()
    const s = useTerminalStore.getState()
    expect(s.sessions).toEqual({})
    expect(s.activeSessionId).toBe(null)
    expect(s.layout).toBe(null)
  })
})
