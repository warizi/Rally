import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import {
  useWorkspaces,
  useWorkspace,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useExportBackup,
  useImportBackup
} from '../queries'

const mockWorkspace = {
  id: 'ws-1',
  name: 'Test Workspace',
  path: '/test/path',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockApi = {
  workspace: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  backup: {
    export: vi.fn(),
    import: vi.fn()
  }
}

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = mockApi
  vi.clearAllMocks()
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

describe('useWorkspaces', () => {
  it('워크스페이스 목록을 반환한다', async () => {
    mockApi.workspace.getAll.mockResolvedValue({ success: true, data: [mockWorkspace] })

    const { result } = renderHook(() => useWorkspaces(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].name).toBe('Test Workspace')
  })

  it('IPC 실패 시 에러를 던진다', async () => {
    mockApi.workspace.getAll.mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: '서버 오류'
    })

    const { result } = renderHook(() => useWorkspaces(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateWorkspace', () => {
  it('워크스페이스를 생성하고 목록을 갱신한다', async () => {
    mockApi.workspace.getAll.mockResolvedValue({ success: true, data: [] })
    mockApi.workspace.create.mockResolvedValue({ success: true, data: mockWorkspace })

    const { result } = renderHook(() => useCreateWorkspace(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ name: 'Test Workspace', path: '/test/path' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.name).toBe('Test Workspace')
    expect(mockApi.workspace.create).toHaveBeenCalledWith('Test Workspace', '/test/path')
  })

  it('IPC 실패 시 에러를 던진다', async () => {
    mockApi.workspace.create.mockResolvedValue({
      success: false,
      errorType: 'ValidationError',
      message: '워크스페이스 이름은 필수입니다'
    })

    const { result } = renderHook(() => useCreateWorkspace(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ name: '', path: '' })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateWorkspace', () => {
  it('워크스페이스 이름을 수정하고 목록을 갱신한다', async () => {
    const updated = { ...mockWorkspace, name: 'Updated' }
    mockApi.workspace.getAll.mockResolvedValue({ success: true, data: [] })
    mockApi.workspace.update.mockResolvedValue({ success: true, data: updated })

    const { result } = renderHook(() => useUpdateWorkspace(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ id: 'ws-1', name: 'Updated' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.name).toBe('Updated')
    expect(mockApi.workspace.update).toHaveBeenCalledWith('ws-1', { name: 'Updated' })
  })

  it('존재하지 않는 워크스페이스 수정 시 에러를 던진다', async () => {
    mockApi.workspace.update.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'Workspace not found'
    })

    const { result } = renderHook(() => useUpdateWorkspace(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ id: 'non-existent', name: 'Updated' })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useDeleteWorkspace', () => {
  it('워크스페이스를 삭제하고 목록을 갱신한다', async () => {
    mockApi.workspace.getAll.mockResolvedValue({ success: true, data: [] })
    mockApi.workspace.delete.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useDeleteWorkspace(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate('ws-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApi.workspace.delete).toHaveBeenCalledWith('ws-1')
  })

  it('마지막 워크스페이스 삭제 시 에러를 던진다', async () => {
    mockApi.workspace.delete.mockResolvedValue({
      success: false,
      errorType: 'ValidationError',
      message: 'Cannot delete the last workspace'
    })

    const { result } = renderHook(() => useDeleteWorkspace(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate('ws-1')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useWorkspace (singular)', () => {
  it('id 로 단일 워크스페이스 조회', async () => {
    mockApi.workspace.getById.mockResolvedValue({ success: true, data: mockWorkspace })
    const { result } = renderHook(() => useWorkspace('ws-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.workspace.getById).toHaveBeenCalledWith('ws-1')
    expect(result.current.data).toEqual(mockWorkspace)
  })

  it('실패 응답 → error', async () => {
    mockApi.workspace.getById.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'not found'
    })
    const { result } = renderHook(() => useWorkspace('missing'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useExportBackup', () => {
  it('exportBackup 호출 → 성공', async () => {
    mockApi.backup.export.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useExportBackup(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate('ws-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.backup.export).toHaveBeenCalledWith('ws-1')
  })

  it('실패 → error', async () => {
    mockApi.backup.export.mockResolvedValue({
      success: false,
      errorType: 'InternalError',
      message: 'fail'
    })
    const { result } = renderHook(() => useExportBackup(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate('ws-1')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useImportBackup', () => {
  it('importBackup 호출 → 성공 + 새 workspace 데이터 반환', async () => {
    mockApi.backup.import.mockResolvedValue({
      success: true,
      data: { ...mockWorkspace, id: 'ws-new' }
    })
    mockApi.workspace.getAll.mockResolvedValue({ success: true, data: [] })
    const { result } = renderHook(() => useImportBackup(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ zipPath: '/b.zip', name: 'N', path: '/p' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.backup.import).toHaveBeenCalledWith('/b.zip', 'N', '/p')
    expect(result.current.data).toMatchObject({ id: 'ws-new' })
  })

  it('실패 → error', async () => {
    mockApi.backup.import.mockResolvedValue({
      success: false,
      errorType: 'ValidationError',
      message: 'fail'
    })
    const { result } = renderHook(() => useImportBackup(), { wrapper: createWrapper() })
    await act(async () => {
      result.current.mutate({ zipPath: '/b.zip', name: 'N', path: '/p' })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
