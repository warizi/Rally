import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { useNoteWatcher, NOTE_EXTERNAL_CHANGED_EVENT } from '../use-note-watcher'
import { markAsOwnWrite } from '../own-write-tracker'
import type { NoteNode } from '../types'

// ─── 테스트 헬퍼 ──────────────────────────────────────────────
function createWrapper(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// ─── window.api mock ──────────────────────────────────────────
// note watcher 콜백은 2개 파라미터: (workspaceId: string, changedRelPaths: string[])
let capturedCb: (workspaceId: string, changedRelPaths: string[]) => void
const mockUnsubscribe = vi.fn()
const mockOnChanged = vi
  .fn()
  .mockImplementation((cb: (workspaceId: string, changedRelPaths: string[]) => void) => {
    capturedCb = cb
    return mockUnsubscribe
  })

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as Record<string, unknown>).api = {
    note: { onChanged: mockOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

// ─── 구독 등록 ────────────────────────────────────────────────
describe('구독 등록', () => {
  it('마운트 시 window.api.note.onChanged가 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useNoteWatcher(), { wrapper })
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })
})

// ─── note 목록 invalidate ─────────────────────────────────────
describe('note 목록 invalidate', () => {
  it('onChanged 수신 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useNoteWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1', [])
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['note', 'workspace', 'ws-1'] })
  })
})

// ─── 외부 변경 파일 content refetch + event dispatch ──────────
describe('외부 변경 파일 content refetch', () => {
  it('changedRelPaths에 일치하는 노트가 있고 ownWrite가 아니면 refetch + event dispatch', async () => {
    const { queryClient, wrapper } = createWrapper()

    const notes: NoteNode[] = [
      {
        id: 'n1',
        title: 'Note',
        relativePath: 'docs/note.md',
        description: '',
        preview: '',
        folderId: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // refetchQueries는 Promise 반환 → .then()에서 event dispatch
    vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined as never)
    vi.spyOn(queryClient, 'getQueryData').mockReturnValue(notes)
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    renderHook(() => useNoteWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1', ['docs/note.md'])
    })

    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: NOTE_EXTERNAL_CHANGED_EVENT })
      )
    )
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({
      queryKey: ['note', 'content', 'n1']
    })
  })

  it('캐시에 없는 경로 → refetchQueries 미호출', () => {
    const { queryClient, wrapper } = createWrapper()
    // invalidateQueries도 mock: React Query v5는 invalidateQueries 내부에서
    // refetchQueries를 호출하므로 내부 호출과 명시적 호출을 구분하기 위해 mock
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as never)
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined as never)
    // QueryCache에 노트 없음
    vi.spyOn(queryClient, 'getQueryData').mockReturnValue(undefined)

    renderHook(() => useNoteWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1', ['docs/note.md'])
    })

    expect(refetchSpy).not.toHaveBeenCalled()
  })
})

// ─── 자체 저장 파일 스킵 ──────────────────────────────────────
describe('자체 저장 파일 스킵', () => {
  it('markAsOwnWrite(noteId) 후 onChanged 수신 시 refetchQueries 미호출', () => {
    const { queryClient, wrapper } = createWrapper()
    // invalidateQueries도 mock: 내부 refetchQueries 호출과 명시적 호출 구분
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as never)
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined as never)

    const notes: NoteNode[] = [
      {
        id: 'n-own-write',
        title: 'Own',
        relativePath: 'own.md',
        description: '',
        preview: '',
        folderId: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    vi.spyOn(queryClient, 'getQueryData').mockReturnValue(notes)

    // own-write-tracker 실제 코드 사용 (mock 안 함) — 고유 ID로 상태 주입
    markAsOwnWrite('n-own-write')

    renderHook(() => useNoteWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1', ['own.md'])
    })

    expect(refetchSpy).not.toHaveBeenCalled()
  })
})

// ─── 언마운트 cleanup ─────────────────────────────────────────
describe('언마운트 cleanup', () => {
  it('언마운트 시 onChanged가 반환한 unsubscribe 함수가 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useNoteWatcher(), { wrapper })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
