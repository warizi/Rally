import { describe, it, expect, vi, afterEach } from 'vitest'
import { markAsOwnWrite, isOwnWrite } from '../own-write-tracker'

// own-write-tracker는 모듈 레벨 Set을 사용하므로 테스트 간 상태가 공유됨.
// 방법 A (권장): 각 테스트에 고유 ID 사용 — 다른 테스트와 충돌 없음
// 방법 B: afterEach에서 fake timer advance로 강제 해제

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
