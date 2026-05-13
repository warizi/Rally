/**
 * useNoteStyle 단위 테스트.
 *
 * IPC mock (window.api.settings) + React Query (useQuery / useMutation) 동작 검증.
 * v1 (light/dark 분리) → v2 (flat + colorLight/colorDark) 마이그레이션 포함.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNoteStyle, parseNoteStyleSettings } from '../use-note-style'
import { DEFAULT_NOTE_STYLE_SETTINGS } from '../defaults'

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
})

describe('parseNoteStyleSettings', () => {
  it('빈 입력 → DEFAULT', () => {
    expect(parseNoteStyleSettings(null)).toEqual(DEFAULT_NOTE_STYLE_SETTINGS)
    expect(parseNoteStyleSettings('')).toEqual(DEFAULT_NOTE_STYLE_SETTINGS)
  })

  it('손상된 JSON → DEFAULT fallback', () => {
    expect(parseNoteStyleSettings('not-json')).toEqual(DEFAULT_NOTE_STYLE_SETTINGS)
  })

  it('v1 형식 (light/dark 분리) → 마이그레이션', () => {
    const v1 = {
      light: {
        h1: {
          fontSize: '3rem',
          lineHeight: 1.2,
          marginTop: '2rem',
          marginBottom: '1rem',
          color: '#ff0000'
        }
      },
      dark: {
        h1: {
          fontSize: '3rem',
          lineHeight: 1.2,
          marginTop: '2rem',
          marginBottom: '1rem',
          color: '#00ff00'
        }
      }
    }
    const parsed = parseNoteStyleSettings(JSON.stringify(v1))
    expect(parsed.h1.fontSize).toBe('3rem')
    expect(parsed.h1.colorLight).toBe('#ff0000')
    expect(parsed.h1.colorDark).toBe('#00ff00')
    // v1 에 없던 bg 필드는 default 로 채워짐
    expect(parsed.h1.backgroundLight).toBe(DEFAULT_NOTE_STYLE_SETTINGS.h1.backgroundLight)
    expect(parsed.codeInline.backgroundLight).toBe(
      DEFAULT_NOTE_STYLE_SETTINGS.codeInline.backgroundLight
    )
    // light 에 없던 요소는 default fallback
    expect(parsed.paragraph).toEqual(DEFAULT_NOTE_STYLE_SETTINGS.paragraph)
  })

  it('v2 형식 (flat) → merge with defaults', () => {
    const v2 = {
      h1: { colorLight: '#abcdef' }
    }
    const parsed = parseNoteStyleSettings(JSON.stringify(v2))
    expect(parsed.h1.colorLight).toBe('#abcdef')
    // 나머지 속성은 default 유지
    expect(parsed.h1.fontSize).toBe(DEFAULT_NOTE_STYLE_SETTINGS.h1.fontSize)
    expect(parsed.h1.colorDark).toBe(DEFAULT_NOTE_STYLE_SETTINGS.h1.colorDark)
  })
})

describe('useNoteStyle', () => {
  it('settings 없음 → DEFAULT 반환', async () => {
    const { result } = renderHook(() => useNoteStyle(), { wrapper: createWrapper().wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings).toEqual(DEFAULT_NOTE_STYLE_SETTINGS)
  })

  it('save 호출 → settings:set IPC + 낙관적 갱신', async () => {
    const { result } = renderHook(() => useNoteStyle(), { wrapper: createWrapper().wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const next = {
      ...result.current.settings,
      h1: { ...result.current.settings.h1, colorLight: '#0000ff' }
    }
    act(() => result.current.save(next))

    await waitFor(() => expect(result.current.settings.h1.colorLight).toBe('#0000ff'))
    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [key, valueStr] = setMock.mock.calls[0]
    expect(key).toBe('noteStyle')
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.h1.colorLight).toBe('#0000ff')
  })

  it('reset 호출 → DEFAULT 로 복원', async () => {
    const custom = {
      ...DEFAULT_NOTE_STYLE_SETTINGS,
      h1: { ...DEFAULT_NOTE_STYLE_SETTINGS.h1, colorLight: '#ff0000' }
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { result } = renderHook(() => useNoteStyle(), { wrapper: createWrapper().wrapper })
    await waitFor(() => expect(result.current.settings.h1.colorLight).toBe('#ff0000'))

    act(() => result.current.reset())

    await waitFor(() =>
      expect(result.current.settings.h1.colorLight).toBe(DEFAULT_NOTE_STYLE_SETTINGS.h1.colorLight)
    )
  })
})
