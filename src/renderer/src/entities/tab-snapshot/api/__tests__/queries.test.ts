import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import {
  useTabSnapshots,
  useCreateTabSnapshot,
  useUpdateTabSnapshot,
  useDeleteTabSnapshot
} from '../queries'

const mockSnapshot = {
  id: 'snap-1',
  name: 'My Snapshot',
  description: null,
  workspaceId: 'ws-1',
  tabsJson: '{"tab-1":{}}',
  panesJson: '{"pane-1":{}}',
  layoutJson: '{"type":"pane"}',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockApi = {
  tabSnapshot: {
    getByWorkspaceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = mockApi
  vi.clearAllMocks()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useTabSnapshots', () => {
  it('스냅샷 목록을 반환한다', async () => {
    mockApi.tabSnapshot.getByWorkspaceId.mockResolvedValue({ success: true, data: [mockSnapshot] })

    const { result } = renderHook(() => useTabSnapshots('ws-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].name).toBe('My Snapshot')
  })

  it('workspaceId가 빈 문자열이면 쿼리가 실행되지 않는다', () => {
    const { result } = renderHook(() => useTabSnapshots(''), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockApi.tabSnapshot.getByWorkspaceId).not.toHaveBeenCalled()
  })

  it('성공 응답에서 data가 null이면 빈 배열을 반환한다', async () => {
    mockApi.tabSnapshot.getByWorkspaceId.mockResolvedValue({ success: true, data: null })

    const { result } = renderHook(() => useTabSnapshots('ws-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('IPC 실패 시 에러 상태가 된다', async () => {
    mockApi.tabSnapshot.getByWorkspaceId.mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: '서버 오류'
    })

    const { result } = renderHook(() => useTabSnapshots('ws-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateTabSnapshot', () => {
  it('스냅샷을 생성하고 올바른 payload를 IPC에 전달한다', async () => {
    mockApi.tabSnapshot.create.mockResolvedValue({ success: true, data: mockSnapshot })

    const { result } = renderHook(() => useCreateTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({
        name: 'My Snapshot',
        workspaceId: 'ws-1',
        tabsJson: '{"tab-1":{}}',
        panesJson: '{"pane-1":{}}',
        layoutJson: '{"type":"pane"}'
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.name).toBe('My Snapshot')
    expect(mockApi.tabSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Snapshot', workspaceId: 'ws-1' })
    )
  })

  it('IPC 실패 시 에러 상태가 된다', async () => {
    mockApi.tabSnapshot.create.mockResolvedValue({
      success: false,
      errorType: 'ValidationError',
      message: '스냅샷 이름은 필수입니다'
    })

    const { result } = renderHook(() => useCreateTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({
        name: '',
        workspaceId: 'ws-1',
        tabsJson: '{}',
        panesJson: '{}',
        layoutJson: '{}'
      })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateTabSnapshot', () => {
  it('스냅샷 이름과 설명을 수정하고 올바른 payload를 IPC에 전달한다', async () => {
    const updated = { ...mockSnapshot, name: 'Updated' }
    mockApi.tabSnapshot.update.mockResolvedValue({ success: true, data: updated })

    const { result } = renderHook(() => useUpdateTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ id: 'snap-1', name: 'Updated' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.name).toBe('Updated')
    expect(mockApi.tabSnapshot.update).toHaveBeenCalledWith(
      'snap-1',
      expect.objectContaining({ name: 'Updated' })
    )
  })

  it('tabsJson/panesJson/layoutJson 포함 payload를 전달한다 (overwrite 기능)', async () => {
    const updated = { ...mockSnapshot, tabsJson: '{"tab-new":{}}' }
    mockApi.tabSnapshot.update.mockResolvedValue({ success: true, data: updated })

    const { result } = renderHook(() => useUpdateTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({
        id: 'snap-1',
        tabsJson: '{"tab-new":{}}',
        panesJson: '{"pane-new":{}}',
        layoutJson: '{"type":"split"}'
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApi.tabSnapshot.update).toHaveBeenCalledWith(
      'snap-1',
      expect.objectContaining({
        tabsJson: '{"tab-new":{}}',
        panesJson: '{"pane-new":{}}',
        layoutJson: '{"type":"split"}'
      })
    )
  })

  it('IPC 실패 시 에러 상태가 된다', async () => {
    mockApi.tabSnapshot.update.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'TabSnapshot not found'
    })

    const { result } = renderHook(() => useUpdateTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ id: 'non-existent', name: 'Updated' })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useDeleteTabSnapshot', () => {
  it('스냅샷을 삭제하고 올바른 id를 IPC에 전달한다', async () => {
    mockApi.tabSnapshot.delete.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useDeleteTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate('snap-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApi.tabSnapshot.delete).toHaveBeenCalledWith('snap-1')
  })

  it('IPC 실패 시 에러 상태가 된다', async () => {
    mockApi.tabSnapshot.delete.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'TabSnapshot not found'
    })

    const { result } = renderHook(() => useDeleteTabSnapshot(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate('non-existent')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
