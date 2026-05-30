/**
 * shared/lib/workspace-own-write.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markWorkspaceOwnWrite, isWorkspaceOwnWrite } from '../workspace-own-write'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('workspace-own-write', () => {
  it('초기 — isWorkspaceOwnWrite=false', () => {
    expect(isWorkspaceOwnWrite('ws-fresh-1')).toBe(false)
  })

  it('mark 후 → isWorkspaceOwnWrite=true', () => {
    markWorkspaceOwnWrite('ws-1')
    expect(isWorkspaceOwnWrite('ws-1')).toBe(true)
  })

  it('2000ms 경과 후 → 자동 만료', () => {
    markWorkspaceOwnWrite('ws-2')
    vi.advanceTimersByTime(2000)
    expect(isWorkspaceOwnWrite('ws-2')).toBe(false)
  })

  it('동일 ws 재mark → 타이머 갱신', () => {
    markWorkspaceOwnWrite('ws-3')
    vi.advanceTimersByTime(1500)
    markWorkspaceOwnWrite('ws-3')
    vi.advanceTimersByTime(1500)
    expect(isWorkspaceOwnWrite('ws-3')).toBe(true)
    vi.advanceTimersByTime(600)
    expect(isWorkspaceOwnWrite('ws-3')).toBe(false)
  })

  it('다른 ws 독립적', () => {
    markWorkspaceOwnWrite('ws-a')
    markWorkspaceOwnWrite('ws-b')
    expect(isWorkspaceOwnWrite('ws-a')).toBe(true)
    expect(isWorkspaceOwnWrite('ws-b')).toBe(true)
    expect(isWorkspaceOwnWrite('ws-c')).toBe(false)
  })
})
