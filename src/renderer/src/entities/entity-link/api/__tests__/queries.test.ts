/**
 * entities/entity-link/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useLinkedEntities, useLinkEntity, useUnlinkEntity, ENTITY_LINK_KEY } from '../queries'

vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: {
    getState: () => ({
      markChecklistStep: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    entityLink: { getLinked: vi.fn(), link: vi.fn(), unlink: vi.fn() }
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

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('entity-link queries', () => {
  it('useLinkedEntities → 성공', async () => {
    vi.mocked(api().entityLink.getLinked).mockResolvedValue({ success: true, data: [] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useLinkedEntities('todo', 't-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().entityLink.getLinked).toHaveBeenCalledWith('todo', 't-1')
  })

  it('useLinkedEntities → entityId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useLinkedEntities('todo', undefined), { wrapper })
    expect(api().entityLink.getLinked).not.toHaveBeenCalled()
  })

  it('useLinkEntity → typeA/idA + typeB/idB + history 무효화', async () => {
    vi.mocked(api().entityLink.link).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useLinkEntity(), { wrapper })
    await act(async () => {
      result.current.mutate({
        typeA: 'note',
        idA: 'n-1',
        typeB: 'todo',
        idB: 't-1',
        workspaceId: 'ws-1'
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [ENTITY_LINK_KEY, 'note', 'n-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: [ENTITY_LINK_KEY, 'todo', 't-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('useUnlinkEntity → typeA/idA + typeB/idB + 모든 history 무효화', async () => {
    vi.mocked(api().entityLink.unlink).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUnlinkEntity(), { wrapper })
    await act(async () => {
      result.current.mutate({ typeA: 'note', idA: 'n-1', typeB: 'todo', idB: 't-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history'] })
  })
})
