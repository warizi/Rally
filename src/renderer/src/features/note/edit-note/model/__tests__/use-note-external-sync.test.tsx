/**
 * features/note/edit-note/model/use-note-external-sync.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { useNoteExternalSync } from '../use-note-external-sync'

vi.mock('@entities/note', () => ({
  NOTE_EXTERNAL_CHANGED_EVENT: 'note-external-changed'
}))

let qc: QueryClient

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('useNoteExternalSync', () => {
  it('초기 editorKey=0 + contentToMount=initialContent', () => {
    const lastSentRef = { current: null }
    const { result } = renderHook(() => useNoteExternalSync('n1', 'hello', lastSentRef), {
      wrapper
    })
    expect(result.current.editorKey).toBe(0)
    expect(result.current.contentToMount).toBe('hello')
  })

  it('외부 파일 변경 이벤트 → editorKey 증가', () => {
    const lastSentRef = { current: null }
    const { result } = renderHook(() => useNoteExternalSync('n1', 'hello', lastSentRef), {
      wrapper
    })
    act(() => {
      window.dispatchEvent(new CustomEvent('note-external-changed', { detail: { noteId: 'n1' } }))
    })
    expect(result.current.editorKey).toBe(1)
  })

  it('다른 noteId 이벤트 → 무시', () => {
    const lastSentRef = { current: null }
    const { result } = renderHook(() => useNoteExternalSync('n1', 'hello', lastSentRef), {
      wrapper
    })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('note-external-changed', { detail: { noteId: 'other' } })
      )
    })
    expect(result.current.editorKey).toBe(0)
  })

  it('initialContent 변경 + lastSentRef 일치 → 자체 쓰기 → key 유지', () => {
    const lastSentRef = { current: 'new content' }
    const { result, rerender } = renderHook(
      ({ content }) => useNoteExternalSync('n1', content, lastSentRef),
      { wrapper, initialProps: { content: 'hello' } }
    )
    rerender({ content: 'new content' })
    expect(result.current.editorKey).toBe(0)
    expect(lastSentRef.current).toBeNull()
  })

  it('initialContent 외부 변경 → editorKey 증가', () => {
    const lastSentRef = { current: null }
    const { result, rerender } = renderHook(
      ({ content }) => useNoteExternalSync('n1', content, lastSentRef),
      { wrapper, initialProps: { content: 'hello' } }
    )
    rerender({ content: 'external change' })
    expect(result.current.editorKey).toBe(1)
    expect(result.current.contentToMount).toBe('external change')
  })
})
