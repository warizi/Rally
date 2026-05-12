/**
 * useNoteStyle 단위 테스트 (Phase 1).
 *
 * IPC mock (window.api.settings) + React Query (useQuery / useMutation) 동작 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNoteStyle } from '../use-note-style'
import { DEFAULT_NOTE_STYLE_SETTINGS } from '../defaults'
import type { NoteStyleSettings } from '../types'

function makeWrapper(): (props: { children: ReactNode }) => ReactNode {
  return ({ children }) => {
    const [qc] = useState(
      () =>
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        })
    )
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
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

describe('useNoteStyle', () => {
  it('settings 없음 → DEFAULT 반환', async () => {
    const { result } = renderHook(() => useNoteStyle(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings).toEqual(DEFAULT_NOTE_STYLE_SETTINGS)
  })

  it('settings 존재 → JSON 파싱해 반환', async () => {
    const custom: NoteStyleSettings = {
      ...DEFAULT_NOTE_STYLE_SETTINGS,
      light: { ...DEFAULT_NOTE_STYLE_SETTINGS.light, h1: { ...DEFAULT_NOTE_STYLE_SETTINGS.light.h1, color: '#ff0000' } }
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { result } = renderHook(() => useNoteStyle(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.light.h1.color).toBe('#ff0000')
  })

  it('손상된 JSON → DEFAULT fallback', async () => {
    getMock.mockResolvedValueOnce({ success: true, data: 'not-valid-json' })
    const { result } = renderHook(() => useNoteStyle(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings).toEqual(DEFAULT_NOTE_STYLE_SETTINGS)
  })

  it('saveMode 호출 → settings:set IPC + 낙관적 갱신', async () => {
    const { result } = renderHook(() => useNoteStyle(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newH1 = { ...result.current.settings.light, h1: { ...result.current.settings.light.h1, color: '#0000ff' } }
    act(() => result.current.saveMode('light', newH1))

    // 낙관적 갱신 — onMutate 가 async (cancelQueries) 이므로 마이크로태스크 후 반영
    await waitFor(() => expect(result.current.settings.light.h1.color).toBe('#0000ff'))

    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [key, valueStr] = setMock.mock.calls[0]
    expect(key).toBe('noteStyle')
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.light.h1.color).toBe('#0000ff')
  })

  it('resetMode 호출 → 해당 mode 만 DEFAULT 로 복원, 다른 mode 는 유지', async () => {
    const custom: NoteStyleSettings = {
      light: { ...DEFAULT_NOTE_STYLE_SETTINGS.light, h1: { ...DEFAULT_NOTE_STYLE_SETTINGS.light.h1, color: '#ff0000' } },
      dark: { ...DEFAULT_NOTE_STYLE_SETTINGS.dark, h1: { ...DEFAULT_NOTE_STYLE_SETTINGS.dark.h1, color: '#00ff00' } }
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { result } = renderHook(() => useNoteStyle(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.settings.dark.h1.color).toBe('#00ff00'))

    act(() => result.current.resetMode('light'))

    await waitFor(() =>
      expect(result.current.settings.light.h1.color).toBe(DEFAULT_NOTE_STYLE_SETTINGS.light.h1.color)
    )
    expect(result.current.settings.dark.h1.color).toBe('#00ff00') // 유지
  })
})
