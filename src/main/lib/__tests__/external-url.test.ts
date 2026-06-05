/**
 * external-url.ts 단위 테스트.
 *
 * 외부 URL 열기 allowlist — http:/https: 만 허용하고
 * file:/mailto:/javascript:/custom protocol/invalid URL 은 차단한다.
 */
import { describe, it, expect } from 'vitest'
import { isAllowedExternalUrl, isAllowedAppNavigation } from '../external-url'

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

describe('isAllowedAppNavigation', () => {
  describe('dev (http dev server)', () => {
    const APP = 'http://localhost:5173/'

    it('동일 origin navigation 은 허용한다 (full reload)', () => {
      expect(isAllowedAppNavigation(APP, 'http://localhost:5173/')).toBe(true)
      expect(isAllowedAppNavigation(APP, 'http://localhost:5173/index.html')).toBe(true)
      // hash routing 형태도 동일 origin 이라 허용 (실제로는 will-navigate 미발생)
      expect(isAllowedAppNavigation(APP, 'http://localhost:5173/#/notes')).toBe(true)
    })

    it('다른 origin/port 는 차단한다', () => {
      expect(isAllowedAppNavigation(APP, 'http://localhost:4173/')).toBe(false)
      expect(isAllowedAppNavigation(APP, 'http://evil.com/')).toBe(false)
      expect(isAllowedAppNavigation(APP, 'https://localhost:5173/')).toBe(false)
    })

    it('임의 외부 http/https navigation 은 차단한다', () => {
      expect(isAllowedAppNavigation(APP, 'https://example.com')).toBe(false)
      expect(isAllowedAppNavigation(APP, 'http://attacker.test/phish')).toBe(false)
    })
  })

  describe('packaged (file:// index.html)', () => {
    const APP = 'file:///Applications/Rally.app/Contents/Resources/renderer/index.html'

    it('동일 file 경로 navigation 은 허용한다 (reload)', () => {
      expect(isAllowedAppNavigation(APP, APP)).toBe(true)
    })

    it('다른 file 경로는 차단한다 (path traversal/임의 파일)', () => {
      expect(isAllowedAppNavigation(APP, 'file:///etc/passwd')).toBe(false)
      expect(
        isAllowedAppNavigation(
          APP,
          'file:///Applications/Rally.app/Contents/Resources/renderer/other.html'
        )
      ).toBe(false)
    })

    it('file 앱에서 외부 http/https navigation 은 차단한다', () => {
      expect(isAllowedAppNavigation(APP, 'https://example.com')).toBe(false)
    })
  })

  describe('위험 scheme / 잘못된 입력', () => {
    const APP = 'http://localhost:5173/'

    it('javascript:/data:/custom protocol navigation 은 차단한다', () => {
      expect(isAllowedAppNavigation(APP, 'javascript:alert(1)')).toBe(false)
      expect(isAllowedAppNavigation(APP, 'data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isAllowedAppNavigation(APP, 'rally://x')).toBe(false)
      expect(isAllowedAppNavigation(APP, 'about:blank')).toBe(false)
    })

    it('잘못된 URL 은 차단한다 (crash 하지 않는다)', () => {
      expect(isAllowedAppNavigation(APP, 'not a url')).toBe(false)
      expect(isAllowedAppNavigation('not a url', 'http://localhost:5173/')).toBe(false)
      expect(isAllowedAppNavigation(APP, '')).toBe(false)
    })
  })
})
