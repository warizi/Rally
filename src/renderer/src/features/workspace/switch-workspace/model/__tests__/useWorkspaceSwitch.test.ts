import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useWorkspaceSwitch } from '../useWorkspaceSwitch'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

vi.mock('@entities/workspace', () => ({
  useWorkspaces: vi.fn()
}))

import { useWorkspaces } from '@entities/workspace'

const ws1 = { id: 'ws-1', name: 'Workspace 1', path: '/path/1', createdAt: new Date(), updatedAt: new Date() }
const ws2 = { id: 'ws-2', name: 'Workspace 2', path: '/path/2', createdAt: new Date(), updatedAt: new Date() }

function createWrapper() {
  const queryClient = new QueryClient()
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useCurrentWorkspaceStore.setState({ currentWorkspaceId: null })
})

describe('useWorkspaceSwitch', () => {
  describe('currentWorkspace', () => {
    it('currentWorkspaceId에 해당하는 워크스페이스를 반환한다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1, ws2] } as ReturnType<typeof useWorkspaces>)
      useCurrentWorkspaceStore.setState({ currentWorkspaceId: 'ws-1' })

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      expect(result.current.currentWorkspace?.name).toBe('Workspace 1')
    })

    it('currentWorkspaceId가 없으면 undefined를 반환한다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1] } as ReturnType<typeof useWorkspaces>)

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      expect(result.current.currentWorkspace).toBeUndefined()
    })
  })

  describe('handleSwitch', () => {
    it('currentWorkspaceId를 업데이트한다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1, ws2] } as ReturnType<typeof useWorkspaces>)

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      act(() => {
        result.current.handleSwitch('ws-2')
      })

      expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-2')
    })
  })

  describe('handleCreated', () => {
    it('생성된 워크스페이스로 전환한다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1, ws2] } as ReturnType<typeof useWorkspaces>)

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      act(() => {
        result.current.handleCreated('ws-2')
      })

      expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-2')
    })
  })

  describe('handleDeleted', () => {
    it('삭제 후 남은 첫 번째 워크스페이스로 전환한다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1, ws2] } as ReturnType<typeof useWorkspaces>)
      useCurrentWorkspaceStore.setState({ currentWorkspaceId: 'ws-1' })

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      act(() => {
        result.current.handleDeleted()
      })

      expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-2')
    })

    it('남은 워크스페이스가 없으면 전환하지 않는다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1] } as ReturnType<typeof useWorkspaces>)
      useCurrentWorkspaceStore.setState({ currentWorkspaceId: 'ws-1' })

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      act(() => {
        result.current.handleDeleted()
      })

      expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-1')
    })
  })

  describe('isLastWorkspace', () => {
    it('워크스페이스가 1개면 true이다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1] } as ReturnType<typeof useWorkspaces>)

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      expect(result.current.isLastWorkspace).toBe(true)
    })

    it('워크스페이스가 2개 이상이면 false이다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [ws1, ws2] } as ReturnType<typeof useWorkspaces>)

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      expect(result.current.isLastWorkspace).toBe(false)
    })

    it('워크스페이스가 없으면 true이다', () => {
      vi.mocked(useWorkspaces).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useWorkspaces>)

      const { result } = renderHook(() => useWorkspaceSwitch(), { wrapper: createWrapper() })
      expect(result.current.isLastWorkspace).toBe(true)
    })
  })
})
