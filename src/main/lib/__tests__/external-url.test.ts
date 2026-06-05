/**
 * external-url.ts 단위 테스트.
 *
 * 외부 URL 열기 allowlist — http:/https: 만 허용하고
 * file:/mailto:/javascript:/custom protocol/invalid URL 은 차단한다.
 */
import { describe, it, expect } from 'vitest'
import { isAllowedExternalUrl } from '../external-url'

describe('isAllowedExternalUrl', () => {
  it('http:/https: URL 은 허용한다', () => {
    expect(isAllowedExternalUrl('http://example.com')).toBe(true)
    expect(isAllowedExternalUrl('https://example.com')).toBe(true)
    expect(isAllowedExternalUrl('https://example.com/path?q=1#frag')).toBe(true)
    expect(isAllowedExternalUrl('HTTPS://EXAMPLE.COM')).toBe(true)
  })

  it('file: scheme 은 차단한다', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
  })

  it('mailto: scheme 은 차단한다', () => {
    expect(isAllowedExternalUrl('mailto:test@example.com')).toBe(false)
  })

  it('javascript: scheme 은 차단한다', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('custom protocol 은 차단한다', () => {
    expect(isAllowedExternalUrl('rally://something')).toBe(false)
  })

  it('잘못된 URL 은 차단한다 (crash 하지 않는다)', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false)
    expect(isAllowedExternalUrl('')).toBe(false)
    expect(isAllowedExternalUrl('//example.com')).toBe(false)
  })
})
