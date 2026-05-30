/**
 * shared/lib/utils/cn.test.ts
 *
 * clsx + twMerge 통합.
 */
import { describe, it, expect } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
  it('단순 클래스 조합', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('falsy 값 제외', () => {
    expect(cn('a', false, 'b', null, undefined)).toBe('a b')
  })

  it('twMerge 동작 — 중복된 tailwind 클래스 정리', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('객체 형식 — true 인 키만 적용', () => {
    expect(cn({ a: true, b: false, c: true })).toBe('a c')
  })

  it('배열 형식', () => {
    expect(cn(['a', 'b'])).toBe('a b')
  })

  it('빈 입력 → 빈 문자열', () => {
    expect(cn()).toBe('')
  })
})
