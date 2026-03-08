import { describe, it, expect, vi, afterEach } from 'vitest'
import { markAsOwnWrite, isOwnWrite } from '../own-write-tracker'

// 모듈 레벨 Map 사용 → 각 테스트에 고유 ID 사용하여 격리
afterEach(() => {
  vi.useRealTimers()
})

// ─── markAsOwnWrite + isOwnWrite ─────────────────────────────
describe('markAsOwnWrite + isOwnWrite', () => {
  it('markAsOwnWrite 후 isOwnWrite → true를 반환한다', () => {
    markAsOwnWrite('unique-id-mark-1')
    expect(isOwnWrite('unique-id-mark-1')).toBe(true)
  })

  it('markAsOwnWrite 호출하지 않은 id → false를 반환한다', () => {
    expect(isOwnWrite('never-marked-id')).toBe(false)
  })
})

// ─── 2초 자동 해제 (fake timer) ───────────────────────────────
describe('2초 자동 해제', () => {
  it('2초 후 자동 해제 → isOwnWrite가 false를 반환한다', () => {
    vi.useFakeTimers()
    markAsOwnWrite('unique-id-expire-1')

    vi.advanceTimersByTime(2001)

    expect(isOwnWrite('unique-id-expire-1')).toBe(false)
  })

  it('2초 이전에는 여전히 true를 반환한다', () => {
    vi.useFakeTimers()
    markAsOwnWrite('unique-id-expire-2')

    vi.advanceTimersByTime(1999)

    expect(isOwnWrite('unique-id-expire-2')).toBe(true)
  })
})

// ─── 타이머 리셋 ─────────────────────────────────────────────
describe('타이머 리셋', () => {
  it('같은 id 재호출 시 타이머가 리셋된다', () => {
    vi.useFakeTimers()
    markAsOwnWrite('unique-id-reset')

    vi.advanceTimersByTime(1000)
    markAsOwnWrite('unique-id-reset') // 1초 후 재호출 → 타이머 리셋

    vi.advanceTimersByTime(1999) // 재호출 시점 기준 1999ms
    expect(isOwnWrite('unique-id-reset')).toBe(true)

    vi.advanceTimersByTime(2) // 총 2001ms → 해제
    expect(isOwnWrite('unique-id-reset')).toBe(false)
  })
})
