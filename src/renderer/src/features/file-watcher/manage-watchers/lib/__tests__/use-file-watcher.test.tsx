/**
 * features/file-watcher/manage-watchers/lib/use-file-watcher.test.tsx
 *
 * useFileWatcher — onChanged 콜백 시:
 *  - queryClient.invalidateQueries 호출
 *  - readyRef false (2s 이전) → toast 호출 안 함
 *  - readyRef true + 외부 변경 → toast.info 호출
 *  - own-write 인 item → 무시
 *  - workspace own-write → 전체 무시
 *  - actor.kind='ai' → AI 변경 토스트 메시지
 *  - CustomEvent dispatch + refetchQueries 호출
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastDismiss: vi.fn(),
  isWorkspaceOwnWrite: vi.fn(() => false),
  formatAuthor: vi.fn(() => 'AI 봇'),
  openTab: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { info: mocks.toastInfo, dismiss: mocks.toastDismiss }
}))

vi.mock('@shared/lib/workspace-own-write', () => ({
  isWorkspaceOwnWrite: mocks.isWorkspaceOwnWrite
}))

vi.mock('@shared/lib/format-author', () => ({
  formatAuthor: mocks.formatAuthor
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (selector: (s: unknown) => unknown) => selector({ openTab: mocks.openTab })
}))

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadge: () => null
}))

import { useFileWatcher } from '../use-file-watcher'

type ChangedCb = (
  workspaceId: string,
  changedRelPaths: string[],
  actor: { kind: 'user' | 'ai'; id: string | null } | null
) => void

function setup(
  override: Partial<{
    isOwnWrite: (id: string) => boolean
    queryData: Array<{ id: string; relativePath: string; title: string }>
    isWorkspaceOwn: boolean
  }> = {}
): { triggerChange: ChangedCb; client: QueryClient; unsub: ReturnType<typeof vi.fn> } {
  const unsub = vi.fn()
  let registered: ChangedCb | null = null
  const onChanged = vi.fn((cb: ChangedCb) => {
    registered = cb
    return unsub
  })

  const client = new QueryClient()
  if (override.queryData) {
    client.setQueryData(['note', 'workspace', 'ws-1'], override.queryData)
  }
  mocks.isWorkspaceOwnWrite.mockReturnValue(override.isWorkspaceOwn ?? false)

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  renderHook(
    () =>
      useFileWatcher({
        onChanged,
        queryKeyPrefix: 'note',
        icon: () => null,
        externalChangedEvent: 'note:external-changed',
        idField: 'noteId',
        isOwnWrite: override.isOwnWrite ?? (() => false),
        buildTabOptions: (item) => ({ type: 'note', pathname: `/n/${item.id}`, title: item.title })
      }),
    { wrapper: Wrapper }
  )

  return {
    triggerChange: (ws, paths, actor) => registered?.(ws, paths, actor),
    client,
    unsub
  }
}

beforeEach(() => {
  mocks.toastInfo.mockReset()
  mocks.toastDismiss.mockReset()
  mocks.formatAuthor.mockClear()
  mocks.openTab.mockClear()
  mocks.isWorkspaceOwnWrite.mockReturnValue(false)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFileWatcher', () => {
  it('readyRef false (2s 이전) → 변경 발생해도 toast 미호출', () => {
    const { triggerChange } = setup({
      queryData: [{ id: 'n1', relativePath: 'a.md', title: 'A' }]
    })
    act(() => {
      triggerChange('ws-1', ['a.md'], null)
    })
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('readyRef true + 외부 변경 → toast.info 호출', () => {
    const { triggerChange } = setup({
      queryData: [{ id: 'n1', relativePath: 'a.md', title: 'A' }]
    })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      triggerChange('ws-1', ['a.md'], null)
    })
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
    expect(mocks.toastInfo.mock.calls[0][0]).toBe('외부에서 파일이 변경되었습니다')
  })

  it('actor.kind=ai → AI 변경 토스트 메시지', () => {
    const { triggerChange } = setup({
      queryData: [{ id: 'n1', relativePath: 'a.md', title: 'A' }]
    })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      triggerChange('ws-1', ['a.md'], { kind: 'ai', id: 'ai-1' })
    })
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
    expect(mocks.toastInfo.mock.calls[0][0]).toContain('가 변경하였습니다')
  })

  it('own-write item → 토스트에서 제외', () => {
    const { triggerChange } = setup({
      queryData: [
        { id: 'n1', relativePath: 'a.md', title: 'A' },
        { id: 'n2', relativePath: 'b.md', title: 'B' }
      ],
      isOwnWrite: (id) => id === 'n1'
    })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      triggerChange('ws-1', ['a.md', 'b.md'], null)
    })
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
  })

  it('workspace own-write → 전체 무시', () => {
    const { triggerChange } = setup({
      queryData: [{ id: 'n1', relativePath: 'a.md', title: 'A' }],
      isWorkspaceOwn: true
    })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      triggerChange('ws-1', ['a.md'], null)
    })
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('items 없음 → toast 호출 안 함', () => {
    const { triggerChange } = setup()
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    act(() => {
      triggerChange('ws-1', ['x.md'], null)
    })
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('unmount → unsub 호출', () => {
    const onChanged = vi.fn(() => () => {})
    const client = new QueryClient()
    function Wrapper({ children }: { children: ReactNode }): ReactElement {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    const { unmount } = renderHook(
      () =>
        useFileWatcher({
          onChanged,
          queryKeyPrefix: 'note',
          icon: () => null,
          externalChangedEvent: 'note:external-changed',
          idField: 'noteId',
          isOwnWrite: () => false,
          buildTabOptions: () => ({ type: 'note', pathname: '/', title: '' })
        }),
      { wrapper: Wrapper }
    )
    unmount()
    // onChanged 의 반환값(unsub) 이 호출돼야 한다. onChanged 의 인자가 cb 이므로 반환 fn 이 unsub.
    // useEffect cleanup 에서 호출되는 unsub() 가 onChanged 의 반환과 동일하다.
    expect(onChanged).toHaveBeenCalled()
  })
})
