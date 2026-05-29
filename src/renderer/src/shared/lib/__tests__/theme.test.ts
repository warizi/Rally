/**
 * shared/lib/theme.test.ts
 *
 * applyTheme — html.dark 토글. applyFontSize — fontSize 변경 + 이벤트 디스패치.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyTheme, applyFontSize, FONT_SIZE_CHANGE_EVENT } from '../theme'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.fontSize = ''
})

describe('applyTheme', () => {
  it('dark → html.dark 추가', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('light → html.dark 제거', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('이미 dark 인 상태에서 dark 호출 → 유지', () => {
    document.documentElement.classList.add('dark')
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('applyFontSize', () => {
  it('small → 13px', () => {
    applyFontSize('small')
    expect(document.documentElement.style.fontSize).toBe('13px')
  })

  it('medium → 15px', () => {
    applyFontSize('medium')
    expect(document.documentElement.style.fontSize).toBe('15px')
  })

  it('large → 17px', () => {
    applyFontSize('large')
    expect(document.documentElement.style.fontSize).toBe('17px')
  })

  it('FONT_SIZE_CHANGE_EVENT 디스패치', () => {
    const cb = vi.fn()
    window.addEventListener(FONT_SIZE_CHANGE_EVENT, cb)
    applyFontSize('medium')
    expect(cb).toHaveBeenCalled()
    window.removeEventListener(FONT_SIZE_CHANGE_EVENT, cb)
  })
})
