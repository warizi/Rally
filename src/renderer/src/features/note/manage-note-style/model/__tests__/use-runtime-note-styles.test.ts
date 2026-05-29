/**
 * features/note/manage-note-style/model/use-runtime-note-styles.test.ts
 *
 * settings 변경 시 #rally-note-styles 동적 갱신. 처음엔 tag 생성, 이후엔 textContent 갱신.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  settings: { foo: 1 } as unknown,
  buildCss: vi.fn(
    (s: unknown, selector: string) => `/* css for ${selector}: ${JSON.stringify(s)} */`
  )
}))

vi.mock('@entities/note-style', () => ({
  useNoteStyle: () => ({ settings: mocks.settings }),
  buildNoteStyleCss: (s: unknown, sel: string) => mocks.buildCss(s, sel)
}))

import { useRuntimeNoteStyles } from '../use-runtime-note-styles'

beforeEach(() => {
  document.head.innerHTML = ''
  mocks.buildCss.mockClear()
  mocks.settings = { foo: 1 }
})

describe('useRuntimeNoteStyles', () => {
  it('첫 mount → #rally-note-styles 신규 생성 + buildNoteStyleCss CSS textContent', () => {
    renderHook(() => useRuntimeNoteStyles())
    const tag = document.getElementById('rally-note-styles')
    expect(tag).toBeInstanceOf(HTMLStyleElement)
    expect(tag?.textContent).toContain('css for [data-rally-note][data-rally-note]')
    expect(mocks.buildCss).toHaveBeenCalledWith({ foo: 1 }, '[data-rally-note][data-rally-note]')
  })

  it('기존 tag 존재 → 신규 생성 안 하고 textContent 만 갱신', () => {
    const existing = document.createElement('style')
    existing.id = 'rally-note-styles'
    existing.textContent = 'old'
    document.head.appendChild(existing)

    renderHook(() => useRuntimeNoteStyles())
    expect(document.querySelectorAll('#rally-note-styles')).toHaveLength(1)
    expect(document.getElementById('rally-note-styles')?.textContent).not.toBe('old')
  })

  it('두 hook 인스턴스 → tag 1 개만 존재 (id 중복 방지)', () => {
    const { unmount: u1 } = renderHook(() => useRuntimeNoteStyles())
    const { unmount: u2 } = renderHook(() => useRuntimeNoteStyles())
    expect(document.querySelectorAll('#rally-note-styles')).toHaveLength(1)
    u1()
    u2()
  })
})
