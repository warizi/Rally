/**
 * widgets/history-timeline/lib/highlight.test.tsx
 *
 * 검색어 매칭 부분 mark wrap. case-insensitive. 매칭 없으면 원본.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightText } from '../highlight'

describe('HighlightText', () => {
  it('query 비어있음 → text 그대로 반환', () => {
    const result = HighlightText({ text: 'hello', query: '' })
    expect(result).toBe('hello')
  })

  it('query 만 공백 → text 그대로', () => {
    const result = HighlightText({ text: 'hello', query: '   ' })
    expect(result).toBe('hello')
  })

  it('매칭 없음 → text 그대로', () => {
    const result = HighlightText({ text: 'hello', query: 'world' })
    expect(result).toBe('hello')
  })

  it('매칭 있음 → <mark> 로 wrap', () => {
    const { container } = render(<>{HighlightText({ text: 'hello world', query: 'world' })}</>)
    expect(container.querySelector('mark')).toHaveTextContent('world')
  })

  it('case-insensitive 매칭', () => {
    const { container } = render(<>{HighlightText({ text: 'Hello World', query: 'world' })}</>)
    expect(container.querySelector('mark')).toHaveTextContent('World')
  })

  it('첫 번째 매칭 위치 기준 wrap', () => {
    const { container } = render(<>{HighlightText({ text: 'foo bar foo', query: 'foo' })}</>)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1) // 첫 매칭만
  })
})
