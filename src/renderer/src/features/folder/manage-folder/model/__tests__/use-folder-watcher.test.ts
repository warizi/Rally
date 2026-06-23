import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFolderWatcher } from '../use-folder-watcher'

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

// ─── 모의 모듈 ─────────────────────────────────────────────
const hoistedMocks = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastDismiss: vi.fn(),
  isWorkspaceOwnWriteMock: vi.fn((_id: string) => false),
  openTabMock: vi.fn()
}))

const { toastInfo, isWorkspaceOwnWriteMock } = hoistedMocks

vi.mock('sonner', () => ({
  toast: { info: hoistedMocks.toastInfo, dismiss: hoistedMocks.toastDismiss }
}))

vi.mock('@shared/lib/workspace-own-write', () => ({
  isWorkspaceOwnWrite: (id: string) => hoistedMocks.isWorkspaceOwnWriteMock(id)
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (selector: (s: unknown) => unknown) =>
    selector({ openTab: hoistedMocks.openTabMock })
}))

vi.mock('@shared/lib/format-author', () => ({
  formatAuthor: () => 'AI 봇'
}))

// ─── window.api mock ──────────────────────────────────────────
type ChangedCb = (
  workspaceId: string,
  changedRelPaths: string[],
  actor: { kind: 'user' | 'ai'; id: string | null } | null
) => void
let capturedCb: ChangedCb
const mockUnsubscribe = vi.fn()
const mockOnChanged = vi.fn().mockImplementation((cb: ChangedCb) => {
  capturedCb = cb
  return mockUnsubscribe
})

beforeEach(() => {
  vi.clearAllMocks()
  isWorkspaceOwnWriteMock.mockReturnValue(false)
  vi.useFakeTimers()
  ;(window as unknown as Record<string, unknown>).api = {
    folder: { onChanged: mockOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  vi.useRealTimers()
})

// ─── 구독 등록 ────────────────────────────────────────────────
describe('구독 등록', () => {
  it('마운트 시 window.api.folder.onChanged가 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useFolderWatcher(), { wrapper })
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })
})

// ─── 이벤트 수신 → invalidation ───────────────────────────────
describe('이벤트 수신 → invalidation', () => {
  it('onChanged 콜백에 workspaceId 전달 시 해당 queryKey를 invalidate한다', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useFolderWatcher(), { wrapper })

    act(() => {
      capturedCb('ws-1', [], null)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })

  it('readyRef true + 외부 변경 → toast.info 호출', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useFolderWatcher(), { wrapper })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      capturedCb('ws-1', ['a/b.md'], null)
    })
    expect(toastInfo).toHaveBeenCalledTimes(1)
    expect(toastInfo.mock.calls[0][0]).toBe('외부에서 폴더가 변경되었습니다')
  })

  it('actor.kind=ai (MCP) → 워처 토스트 미호출 (mcp:activity 가 담당)', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useFolderWatcher(), { wrapper })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      capturedCb('ws-1', ['a.md'], { kind: 'ai', id: 'agent-1' })
    })
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('isWorkspaceOwnWrite=true → toast 미호출', () => {
    isWorkspaceOwnWriteMock.mockReturnValue(true)
    const { wrapper } = createWrapper()
    renderHook(() => useFolderWatcher(), { wrapper })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      capturedCb('ws-1', ['a.md'], null)
    })
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('readyRef false (2s 이전) → toast 미호출', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useFolderWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1', ['a.md'], null)
    })
    expect(toastInfo).not.toHaveBeenCalled()
  })
})

// ─── 언마운트 cleanup ─────────────────────────────────────────
describe('언마운트 cleanup', () => {
  it('언마운트 시 onChanged가 반환한 unsubscribe 함수가 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useFolderWatcher(), { wrapper })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
