import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMcpActivityWatcher } from '../use-mcp-activity-watcher'

function createWrapper(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const hoistedMocks = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastDismiss: vi.fn(),
  openTabMock: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { info: hoistedMocks.toastInfo, dismiss: hoistedMocks.toastDismiss }
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (selector: (s: unknown) => unknown) =>
    selector({ openTab: hoistedMocks.openTabMock })
}))

vi.mock('@shared/lib/format-author', () => ({
  formatAuthor: (_kind: string, id: string | null) => id ?? 'AI'
}))

type ActivityCb = (payload: unknown) => void
let capturedCb: ActivityCb
const mockUnsub = vi.fn()
const mockOnActivity = vi.fn().mockImplementation((cb: ActivityCb) => {
  capturedCb = cb
  return mockUnsub
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as Record<string, unknown>).api = {
    mcpActivity: { onActivity: mockOnActivity }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useMcpActivityWatcher', () => {
  it('단일 항목 → "{who}가 {도메인} \'{제목}\' {동작}" 토스트', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useMcpActivityWatcher(), { wrapper })
    act(() => {
      capturedCb({
        workspaceId: 'ws-1',
        actor: { kind: 'ai', id: 'claude-code' },
        records: [
          {
            domain: 'note',
            operation: 'create',
            items: [{ type: 'note', id: 'n1', title: '메모' }]
          }
        ]
      })
    })
    expect(hoistedMocks.toastInfo).toHaveBeenCalledTimes(1)
    expect(hoistedMocks.toastInfo.mock.calls[0][0]).toBe("claude-code가 노트 '메모' 생성")
  })

  it('여러 항목 → "{who}가 {도메인} N개 {동작}" 묶음 토스트', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useMcpActivityWatcher(), { wrapper })
    act(() => {
      capturedCb({
        workspaceId: 'ws-1',
        actor: { kind: 'ai', id: 'cursor' },
        records: [
          {
            domain: 'todo',
            operation: 'create',
            items: [
              { type: 'todo', id: 't1', title: 'A' },
              { type: 'todo', id: 't2', title: 'B' }
            ]
          }
        ]
      })
    })
    expect(hoistedMocks.toastInfo.mock.calls[0][0]).toBe('cursor가 할일 2개 생성')
  })

  it('각 record 마다 해당 도메인 캐시를 invalidate 한다', () => {
    const { wrapper, queryClient } = createWrapper()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    renderHook(() => useMcpActivityWatcher(), { wrapper })
    act(() => {
      capturedCb({
        workspaceId: 'ws-1',
        actor: { kind: 'ai', id: 'ai' },
        records: [
          {
            domain: 'schedule',
            operation: 'update',
            items: [{ type: 'schedule', id: 's1', title: 'S' }]
          }
        ]
      })
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['schedule'] })
  })
})
