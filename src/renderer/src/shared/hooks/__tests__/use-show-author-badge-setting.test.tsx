/**
 * shared/hooks/use-show-author-badge-setting.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { useShowAuthorBadgeSetting } from '../use-show-author-badge-setting'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}))

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mocks.get.mockReset()
  mocks.set.mockReset()
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { get: mocks.get, set: mocks.set }
  }
})

describe('useShowAuthorBadgeSetting', () => {
  it('저장값 없음 → default true', async () => {
    mocks.get.mockResolvedValue({ success: true, data: null })
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), { wrapper })
    await waitFor(() => expect(result.current.show).toBe(true))
  })

  it('저장값 "false" → show=false', async () => {
    mocks.get.mockResolvedValue({ success: true, data: 'false' })
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), { wrapper })
    await waitFor(() => expect(result.current.show).toBe(false))
  })

  it('저장값 "true" → show=true', async () => {
    mocks.get.mockResolvedValue({ success: true, data: 'true' })
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), { wrapper })
    await waitFor(() => expect(result.current.show).toBe(true))
  })

  it('setShow → window.api.settings.set 호출', async () => {
    mocks.get.mockResolvedValue({ success: true, data: 'true' })
    mocks.set.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), { wrapper })
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => {
      await result.current.setShow(false)
    })
    expect(mocks.set).toHaveBeenCalledWith('authorBadge.show', 'false')
  })

  it('get success=false → default true (fallback)', async () => {
    mocks.get.mockResolvedValue({ success: false })
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), { wrapper })
    await waitFor(() => expect(result.current.show).toBe(true))
  })
})
