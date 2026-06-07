/**
 * entities/search/api — useGlobalSearch (일치/유사 그룹 분리·중복제거·상한)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useGlobalSearch } from '../queries'
import type { SearchHit, SearchType } from '../../model/types'

function hit(type: SearchType, id: string): SearchHit {
  return {
    type,
    id,
    title: `${type}-${id}`,
    matchType: 'title',
    folderId: null,
    folderPath: null,
    updatedAt: '2026-01-01T00:00:00Z',
    preview: null
  }
}

const queryMock = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = { search: { query: queryMock } }
  queryMock.mockReset()
})

function wrapper(): ({ children }: { children: ReactNode }) => ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return createElement(QueryClientProvider, { client: qc }, children)
  }
  return Wrapper
}

/** mode 별로 다른 결과를 돌려주는 mock 설정 */
function mockByMode(keyword: SearchHit[], semantic: SearchHit[]): void {
  queryMock.mockImplementation(async (_ws: string, _q: string, opts: { mode: string }) => ({
    success: true,
    data: { results: opts.mode === 'semantic' ? semantic : keyword }
  }))
}

describe('useGlobalSearch', () => {
  it('keyword(6도메인) + semantic(4도메인) 2회 호출', async () => {
    mockByMode([], [])
    const { result } = renderHook(() => useGlobalSearch('ws', 'plan'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(queryMock).toHaveBeenCalledTimes(2)
    const calls = queryMock.mock.calls
    const kw = calls.find((c) => c[2].mode === 'keyword')![2]
    const sem = calls.find((c) => c[2].mode === 'semantic')![2]
    expect(kw.types.sort()).toEqual(['canvas', 'image', 'note', 'pdf', 'table', 'todo'])
    expect(sem.types.sort()).toEqual(['canvas', 'note', 'table', 'todo'])
  })

  it('일치(keyword) / 유사(semantic) 그룹 분리', async () => {
    mockByMode([hit('note', 'A'), hit('pdf', 'B')], [hit('note', 'C')])
    const { result } = renderHook(() => useGlobalSearch('ws', 'plan'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.exact.map((h) => h.id)).toEqual(['A', 'B'])
    expect(result.current.data!.similar.map((h) => h.id)).toEqual(['C'])
  })

  it('유사 그룹에서 일치(type+id) 중복 제거', async () => {
    mockByMode([hit('note', 'A')], [hit('note', 'A'), hit('note', 'C')])
    const { result } = renderHook(() => useGlobalSearch('ws', 'plan'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.exact.map((h) => h.id)).toEqual(['A'])
    expect(result.current.data!.similar.map((h) => h.id)).toEqual(['C']) // A 제거됨
  })

  it('상한 일치 50 / 유사 20', async () => {
    const kw = Array.from({ length: 60 }, (_, i) => hit('note', `k${i}`))
    const sem = Array.from({ length: 30 }, (_, i) => hit('todo', `s${i}`))
    mockByMode(kw, sem)
    const { result } = renderHook(() => useGlobalSearch('ws', 'plan'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.exact).toHaveLength(50)
    expect(result.current.data!.similar).toHaveLength(20)
  })

  it('빈 쿼리 → 비활성(호출 없음)', () => {
    renderHook(() => useGlobalSearch('ws', '   '), { wrapper: wrapper() })
    expect(queryMock).not.toHaveBeenCalled()
  })
})
