/**
 * shared/lib/create-own-write-tracker.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOwnWriteTracker } from '../create-own-write-tracker'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createOwnWriteTracker', () => {
  it('초기 상태 — isOwnWrite 항상 false', () => {
    const t = createOwnWriteTracker()
    expect(t.isOwnWrite('any-id')).toBe(false)
  })

  it('markAsOwnWrite → isOwnWrite=true', () => {
    const t = createOwnWriteTracker()
    t.markAsOwnWrite('id1')
    expect(t.isOwnWrite('id1')).toBe(true)
  })

  it('timeoutMs 경과 후 → 자동 만료', () => {
    const t = createOwnWriteTracker(1000)
    t.markAsOwnWrite('id1')
    vi.advanceTimersByTime(1000)
    expect(t.isOwnWrite('id1')).toBe(false)
  })

  it('동일 id 재호출 → 이전 timer 취소', () => {
    const t = createOwnWriteTracker(1000)
    t.markAsOwnWrite('id1')
    vi.advanceTimersByTime(500)
    t.markAsOwnWrite('id1') // 재호출 → 타이머 갱신
    vi.advanceTimersByTime(700)
    // 첫 호출 기준 1000ms 지났지만 두 번째 호출 시점에서 1000ms 안 지남
    expect(t.isOwnWrite('id1')).toBe(true)
    vi.advanceTimersByTime(400)
    expect(t.isOwnWrite('id1')).toBe(false)
  })

  it('다른 id 는 독립적', () => {
    const t = createOwnWriteTracker(1000)
    t.markAsOwnWrite('a')
    t.markAsOwnWrite('b')
    expect(t.isOwnWrite('a')).toBe(true)
    expect(t.isOwnWrite('b')).toBe(true)
    expect(t.isOwnWrite('c')).toBe(false)
  })
})
