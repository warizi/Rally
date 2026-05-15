/**
 * useRuntimeToolbarColors 단위 테스트.
 *
 * buildToolbarColorsCss 의 출력 형식 + hook 이 <head> 에 <style> 을 inject 하는지.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { buildToolbarColorsCss, useRuntimeToolbarColors } from '../use-runtime-toolbar-colors'
import { DEFAULT_TOOLBAR_PALETTE, PALETTE_SLOT_COUNT } from '../../index'

const STYLE_ID = 'rally-note-toolbar-colors'

function createWrapper(): {
  qc: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

let getMock: ReturnType<typeof vi.fn>
let setMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  getMock = vi.fn().mockResolvedValue({ success: true, data: null })
  setMock = vi.fn().mockResolvedValue({ success: true })
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { get: getMock, set: setMock }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  const el = document.getElementById(STYLE_ID)
  if (el) el.remove()
})

describe('buildToolbarColorsCss', () => {
  it('8 슬롯 다크 색상 모두에 대해 !important 규칙 생성', () => {
    const css = buildToolbarColorsCss(DEFAULT_TOOLBAR_PALETTE.dark)
    for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
      expect(css).toContain(`[data-color-slot="${i}"]`)
      expect(css).toContain(DEFAULT_TOOLBAR_PALETTE.dark[i])
      expect(css).toContain('!important')
    }
  })

  it('html.dark 스코프로 감쌈 (라이트 모드에서는 적용 안 됨)', () => {
    const css = buildToolbarColorsCss(DEFAULT_TOOLBAR_PALETTE.dark)
    // 모든 규칙이 html.dark 로 시작
    const lines = css.split('\n').filter((l) => l.trim())
    for (const line of lines) {
      expect(line, line).toContain('html.dark')
    }
  })

  it('빈 슬롯은 규칙 생성 안 함', () => {
    const css = buildToolbarColorsCss(['', '', '', '', '', '', '', ''])
    expect(css).toBe('')
  })

  it('[data-rally-note] 스코프로 다른 영역에 영향 안 미침', () => {
    const css = buildToolbarColorsCss(DEFAULT_TOOLBAR_PALETTE.dark)
    expect(css).toContain('[data-rally-note]')
  })
})

describe('useRuntimeToolbarColors', () => {
  it('mount 시 <style id="rally-note-toolbar-colors"> 가 <head> 에 inject', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useRuntimeToolbarColors(), { wrapper })

    await waitFor(() => {
      const el = document.getElementById(STYLE_ID)
      expect(el).not.toBeNull()
      expect(el?.tagName).toBe('STYLE')
    })
  })

  it('주입된 CSS 가 default 다크 팔레트 hex 를 포함', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useRuntimeToolbarColors(), { wrapper })

    await waitFor(() => {
      const el = document.getElementById(STYLE_ID)
      expect(el?.textContent).toContain(DEFAULT_TOOLBAR_PALETTE.dark[0])
      expect(el?.textContent).toContain(DEFAULT_TOOLBAR_PALETTE.dark[7])
    })
  })

  it('사용자 커스텀 다크 팔레트 hex 가 CSS 에 반영', async () => {
    const custom = {
      light: DEFAULT_TOOLBAR_PALETTE.light,
      dark: ['#aabbcc', '#ddeeff', '#112233', '#445566', '#778899', '#9988aa', '#abcdef', '#fedcba']
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { wrapper } = createWrapper()
    renderHook(() => useRuntimeToolbarColors(), { wrapper })

    await waitFor(() => {
      const el = document.getElementById(STYLE_ID)
      expect(el?.textContent).toContain('#aabbcc')
      expect(el?.textContent).toContain('#fedcba')
    })
  })

  it('중복 mount 시 같은 id 의 <style> 재사용 (중복 추가 X)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useRuntimeToolbarColors(), { wrapper })
    renderHook(() => useRuntimeToolbarColors(), { wrapper })

    await waitFor(() => {
      const els = document.querySelectorAll(`#${STYLE_ID}`)
      expect(els.length).toBe(1)
    })
  })
})
