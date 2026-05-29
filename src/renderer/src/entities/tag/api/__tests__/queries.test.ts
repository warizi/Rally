/**
 * entities/tag/api/queries.test.ts
 *
 * useTags / useItemTags / useItemIdsByTag + mutations (create/update/remove/attach/detach).
 * 각 hook 의 IPC 호출 + onSuccess 무효화 키 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useTags,
  useItemTags,
  useItemIdsByTag,
  useCreateTag,
  useUpdateTag,
  useRemoveTag,
  useAttachTag,
  useDetachTag,
  TAG_KEY,
  ITEM_TAG_KEY
} from '../queries'

const TAG = {
  id: 'tag-1',
  workspaceId: 'ws-1',
  name: 'Important',
  color: '#ff0000',
  description: null,
  createdAt: new Date('2026-01-01')
}

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    tag: {
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    },
    itemTag: {
      getTagsByItem: vi.fn(),
      getItemIdsByTag: vi.fn(),
      attach: vi.fn(),
      detach: vi.fn()
    }
  }
  vi.clearAllMocks()
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

function api(): typeof window.api {
  return (window as unknown as { api: typeof window.api }).api
}

describe('useTags', () => {
  it('데이터 fetch', async () => {
    vi.mocked(api().tag.getAll).mockResolvedValue({ success: true, data: [TAG] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTags('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([TAG])
  })

  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTags(undefined), { wrapper })
    expect(result.current.isPending).toBe(true)
    expect(api().tag.getAll).not.toHaveBeenCalled()
  })

  it('IPC 실패 → isError', async () => {
    vi.mocked(api().tag.getAll).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'x'
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTags('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useItemTags / useItemIdsByTag', () => {
  it('useItemTags → itemTag.getTagsByItem 위임', async () => {
    vi.mocked(api().itemTag.getTagsByItem).mockResolvedValue({ success: true, data: [TAG] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useItemTags('note', 'n-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().itemTag.getTagsByItem).toHaveBeenCalledWith('note', 'n-1')
  })

  it('useItemIdsByTag → tagId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useItemIdsByTag(undefined, 'note'), { wrapper })
    expect(api().itemTag.getItemIdsByTag).not.toHaveBeenCalled()
  })
})

describe('useCreateTag', () => {
  it('성공 → TAG_KEY 무효화', async () => {
    vi.mocked(api().tag.create).mockResolvedValue({ success: true, data: TAG })
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTag(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', input: { name: 'New', color: '#000' } })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TAG_KEY, 'ws-1'] })
  })
})

describe('useUpdateTag', () => {
  it('성공 → TAG_KEY 무효화', async () => {
    vi.mocked(api().tag.update).mockResolvedValue({ success: true, data: TAG })
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateTag(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 'tag-1', input: { name: 'X' }, workspaceId: 'ws-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TAG_KEY, 'ws-1'] })
  })
})

describe('useRemoveTag', () => {
  it('성공 → TAG_KEY + ITEM_TAG_KEY 둘 다 무효화', async () => {
    vi.mocked(api().tag.remove).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveTag(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 'tag-1', workspaceId: 'ws-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TAG_KEY, 'ws-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [ITEM_TAG_KEY] })
  })
})

describe('useAttachTag / useDetachTag', () => {
  it('useAttachTag → ITEM_TAG_KEY/itemType/itemId 무효화', async () => {
    vi.mocked(api().itemTag.attach).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useAttachTag(), { wrapper })
    await act(async () => {
      result.current.mutate({ itemType: 'note', tagId: 'tag-1', itemId: 'n-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [ITEM_TAG_KEY, 'note', 'n-1'] })
  })

  it('useDetachTag → ITEM_TAG_KEY/itemType/itemId 무효화', async () => {
    vi.mocked(api().itemTag.detach).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDetachTag(), { wrapper })
    await act(async () => {
      result.current.mutate({ itemType: 'note', tagId: 'tag-1', itemId: 'n-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [ITEM_TAG_KEY, 'note', 'n-1'] })
  })
})
