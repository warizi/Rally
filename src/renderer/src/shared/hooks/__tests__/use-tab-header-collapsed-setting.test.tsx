/**
 * shared/hooks/use-tab-header-collapsed-setting.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { useTabHeaderCollapsedSetting } from '../use-tab-header-collapsed-setting'

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

describe('useTabHeaderCollapsedSetting', () => {
  it('default false', async () => {
    mocks.get.mockResolvedValue({ success: true, data: null })
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), { wrapper })
    await waitFor(() => expect(result.current.collapsed).toBe(false))
  })

  it('저장값 "true" → collapsed=true', async () => {
    mocks.get.mockResolvedValue({ success: true, data: 'true' })
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), { wrapper })
    await waitFor(() => expect(result.current.collapsed).toBe(true))
  })

  it('setCollapsed → window.api.settings.set 호출', async () => {
    mocks.get.mockResolvedValue({ success: true, data: 'false' })
    mocks.set.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), { wrapper })
    await waitFor(() => expect(result.current.collapsed).toBe(false))
    await act(async () => {
      await result.current.setCollapsed(true)
    })
    expect(mocks.set).toHaveBeenCalledWith('tabHeader.defaultCollapsed', 'true')
  })
})
