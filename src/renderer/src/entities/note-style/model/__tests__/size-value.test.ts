import { describe, it, expect } from 'vitest'
import { formatSize, parseSize } from '../size-value'

describe('parseSize', () => {
  it('rem 문자열 파싱', () => {
    expect(parseSize('1.875rem')).toEqual({ value: 1.875, unit: 'rem' })
  })

  it('px 문자열 파싱', () => {
    expect(parseSize('16px')).toEqual({ value: 16, unit: 'px' })
  })

  it('공백 포함', () => {
    expect(parseSize('  16px  ')).toEqual({ value: 16, unit: 'px' })
    expect(parseSize('16 px')).toEqual({ value: 16, unit: 'px' })
  })

  it('단위 누락 → rem 간주', () => {
    expect(parseSize('1.5')).toEqual({ value: 1.5, unit: 'rem' })
  })

  it('알 수 없는 단위 → rem fallback', () => {
    expect(parseSize('1em')).toEqual({ value: 1, unit: 'rem' })
    expect(parseSize('50%')).toEqual({ value: 50, unit: 'rem' })
  })

  it('0 처리', () => {
    expect(parseSize('0')).toEqual({ value: 0, unit: 'rem' })
    expect(parseSize('0px')).toEqual({ value: 0, unit: 'px' })
  })

  it('빈 문자열 / 잘못된 입력', () => {
    expect(parseSize('')).toEqual({ value: 0, unit: 'rem' })
    expect(parseSize('abc')).toEqual({ value: 0, unit: 'rem' })
  })

  it('대소문자 무관', () => {
    expect(parseSize('1.5REM')).toEqual({ value: 1.5, unit: 'rem' })
    expect(parseSize('16PX')).toEqual({ value: 16, unit: 'px' })
  })
})

describe('formatSize', () => {
  it('정수 + rem', () => {
    expect(formatSize({ value: 2, unit: 'rem' })).toBe('2rem')
  })

  it('소수 + rem — 2자리 반올림 (1.875 → 1.88)', () => {
    expect(formatSize({ value: 1.875, unit: 'rem' })).toBe('1.88rem')
  })

  it('px', () => {
    expect(formatSize({ value: 16, unit: 'px' })).toBe('16px')
  })

  it('부동소수 정밀도 안정화 (1.05 + 0.05 = 1.1)', () => {
    expect(formatSize({ value: 1.05 + 0.05, unit: 'rem' })).toBe('1.1rem')
  })

  it('px→rem 환산 결과 (4.5/16 = 0.28125) 도 2자리 반올림 → 0.28', () => {
    expect(formatSize({ value: 4.5 / 16, unit: 'rem' })).toBe('0.28rem')
  })

  it('round-trip: parse → format (2자리 정규화)', () => {
    expect(formatSize(parseSize('1.875rem'))).toBe('1.88rem')
    expect(formatSize(parseSize('16px'))).toBe('16px')
  })
})
