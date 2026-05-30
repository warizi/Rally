/**
 * shared/lib/format-author.test.ts
 */
import { describe, it, expect } from 'vitest'
import { formatAuthor, formatAuthorRelativeTime, formatAuthorTooltip } from '../format-author'

describe('formatAuthor', () => {
  it('user → "사용자"', () => {
    expect(formatAuthor('user', null)).toBe('사용자')
  })

  it('ai + byId → "AI (id)"', () => {
    expect(formatAuthor('ai', 'gpt-4')).toBe('AI (gpt-4)')
  })

  it('ai + byId=null → "AI"', () => {
    expect(formatAuthor('ai', null)).toBe('AI')
  })
})

describe('formatAuthorRelativeTime', () => {
  it('Date 객체 → 상대시간 (한국어, suffix)', () => {
    const result = formatAuthorRelativeTime(new Date(Date.now() - 60 * 1000))
    expect(result).toMatch(/전|이내/)
  })

  it('ISO string → Date 변환 후 동일', () => {
    const result = formatAuthorRelativeTime(new Date().toISOString())
    expect(typeof result).toBe('string')
  })

  it('number (timestamp) → 변환', () => {
    expect(typeof formatAuthorRelativeTime(Date.now())).toBe('string')
  })
})

describe('formatAuthorTooltip', () => {
  it('at 없음 → 작성자만', () => {
    expect(formatAuthorTooltip('user', null)).toBe('사용자')
  })

  it('action=created → "생성"', () => {
    const result = formatAuthorTooltip('user', null, new Date(), 'created')
    expect(result).toMatch(/생성$/)
  })

  it('action=updated (기본) → "수정"', () => {
    const result = formatAuthorTooltip('user', null, new Date())
    expect(result).toMatch(/수정$/)
  })

  it('ai 작성자 + at → "AI가 ... 수정"', () => {
    const result = formatAuthorTooltip('ai', null, new Date())
    expect(result).toMatch(/^AI가 .* 수정$/)
  })
})
