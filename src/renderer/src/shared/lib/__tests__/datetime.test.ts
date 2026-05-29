import { describe, it, expect } from 'vitest'
import { formatTime, applyTime } from '../datetime'

describe('formatTime', () => {
  it('null → null', () => expect(formatTime(null)).toBeNull())

  it('10:30 → "10:30"', () => {
    const d = new Date()
    d.setHours(10, 30, 0, 0)
    expect(formatTime(d)).toBe('10:30')
  })

  it('00:00 정각 → null (시간 미설정)', () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    expect(formatTime(d)).toBeNull()
  })

  it('한 자리 시/분 → zero-pad', () => {
    const d = new Date()
    d.setHours(5, 7, 0, 0)
    expect(formatTime(d)).toBe('05:07')
  })
})

describe('applyTime', () => {
  it('date null → null', () => expect(applyTime(null, '10:00')).toBeNull())

  it('time null → 00:00 으로 리셋', () => {
    const d = new Date('2026-05-29T15:30:00')
    const result = applyTime(d, null)!
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  // 주의: 소스의 destructuring 기본값 `[hh = '0']` 는 undefined 일 때만 적용.
  // 빈 문자열 ''.split(':') = [''] → hh='' (default 안 탐) → parseInt('') = NaN.
  // 즉 time='' 은 invalid Date 반환. 호출자는 null 을 써야 한다.
  it('time 빈 문자열 → invalid Date (NaN 시간)', () => {
    const d = new Date('2026-05-29T15:30:00')
    const result = applyTime(d, '')!
    expect(result.getHours()).toBeNaN()
  })

  it('정상 적용', () => {
    const d = new Date('2026-05-29T00:00:00')
    const result = applyTime(d, '14:25')!
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(25)
  })

  it('초/밀리초는 0으로 리셋', () => {
    const d = new Date('2026-05-29T10:00:30.500')
    const result = applyTime(d, '12:00')!
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})
