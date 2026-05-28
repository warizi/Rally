import { describe, it, expect } from 'vitest'
import { toDate, toNullableDate, toMs } from '../date'

describe('toDate', () => {
  it('Date 인스턴스는 그대로 반환', () => {
    const d = new Date('2026-05-29T00:00:00Z')
    expect(toDate(d)).toBe(d)
  })

  it('number 는 새 Date 로 변환', () => {
    const ms = 1748000000000
    const result = toDate(ms)
    expect(result).toBeInstanceOf(Date)
    expect(result.getTime()).toBe(ms)
  })

  it('0 (epoch) 도 정상 변환', () => {
    const result = toDate(0)
    expect(result.getTime()).toBe(0)
  })
})

describe('toNullableDate', () => {
  it('null → null', () => {
    expect(toNullableDate(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(toNullableDate(undefined)).toBeNull()
  })

  it('Date 인스턴스는 그대로 반환', () => {
    const d = new Date('2026-05-29T00:00:00Z')
    expect(toNullableDate(d)).toBe(d)
  })

  it('number 는 새 Date 로 변환', () => {
    const ms = 1748000000000
    const result = toNullableDate(ms)
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).getTime()).toBe(ms)
  })

  it('0 (epoch) 은 Date 로 반환 (falsy 트랩 회피)', () => {
    const result = toNullableDate(0)
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).getTime()).toBe(0)
  })
})

describe('toMs', () => {
  it('Date → epoch ms', () => {
    const d = new Date(1748000000000)
    expect(toMs(d)).toBe(1748000000000)
  })

  it('number 는 그대로 반환', () => {
    expect(toMs(1748000000000)).toBe(1748000000000)
  })

  it('0 (epoch) 도 정상', () => {
    expect(toMs(0)).toBe(0)
    expect(toMs(new Date(0))).toBe(0)
  })
})
