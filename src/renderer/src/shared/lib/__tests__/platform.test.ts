/**
 * shared/lib/platform 단위 테스트.
 *
 * window.electron.process.platform 래퍼 — fallback(darwin)과 cache 동작 검증.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getPlatform, isMac, isWindows, isLinux, __resetPlatformCacheForTest } from '../platform'

function setPlatform(platform: string): void {
  ;(window as unknown as { electron?: unknown }).electron = {
    process: { platform }
  }
}

beforeEach(() => {
  __resetPlatformCacheForTest()
})

afterEach(() => {
  delete (window as unknown as { electron?: unknown }).electron
  __resetPlatformCacheForTest()
})

describe('getPlatform', () => {
  it('win32 → win32 / isWindows true / isMac false', () => {
    setPlatform('win32')
    expect(getPlatform()).toBe('win32')
    expect(isWindows()).toBe(true)
    expect(isMac()).toBe(false)
  })

  it('darwin → isMac true', () => {
    setPlatform('darwin')
    expect(getPlatform()).toBe('darwin')
    expect(isMac()).toBe(true)
    expect(isWindows()).toBe(false)
  })

  it('linux → isLinux true', () => {
    setPlatform('linux')
    expect(isLinux()).toBe(true)
    expect(isMac()).toBe(false)
  })

  it('window.electron 부재 → darwin fallback', () => {
    expect(getPlatform()).toBe('darwin')
    expect(isMac()).toBe(true)
  })

  it('예상 외 값(freebsd) → darwin fallback', () => {
    setPlatform('freebsd')
    expect(getPlatform()).toBe('darwin')
  })

  it('cache — reset 전에는 첫 판별값 유지, reset 후 새 값 반영', () => {
    setPlatform('win32')
    expect(getPlatform()).toBe('win32')

    setPlatform('darwin')
    expect(getPlatform()).toBe('win32') // cache 유지

    __resetPlatformCacheForTest()
    expect(getPlatform()).toBe('darwin') // reset 후 반영
  })
})
