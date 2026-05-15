/**
 * useToolbarPalette 단위 테스트.
 *
 * IPC mock (window.api.settings) + React Query (useQuery / useMutation) 동작 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useToolbarPalette, parseToolbarPalette } from '../use-palette'
import { DEFAULT_TOOLBAR_PALETTE } from '../defaults'

function createWrapper(): {
  qc: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

let getMock: ReturnType<typeof vi.fn>
let setMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  getMock = vi.fn().mockResolvedValue({ success: true, data: null })
  setMock = vi.fn().mockResolvedValue({ success: true })
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { get: getMock, set: setMock }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('parseToolbarPalette', () => {
  it('빈 입력 → DEFAULT', () => {
    expect(parseToolbarPalette(null)).toEqual(DEFAULT_TOOLBAR_PALETTE)
    expect(parseToolbarPalette('')).toEqual(DEFAULT_TOOLBAR_PALETTE)
  })

  it('손상된 JSON → DEFAULT fallback', () => {
    expect(parseToolbarPalette('not-json')).toEqual(DEFAULT_TOOLBAR_PALETTE)
  })

  it('일부 슬롯만 정의된 부분 데이터 → DEFAULT 와 merge', () => {
    const partial = {
      light: ['#111111', '#222222'],
      dark: ['#aaaaaa']
    }
    const parsed = parseToolbarPalette(JSON.stringify(partial))
    expect(parsed.light[0]).toBe('#111111')
    expect(parsed.light[1]).toBe('#222222')
    expect(parsed.light[2]).toBe(DEFAULT_TOOLBAR_PALETTE.light[2])
    expect(parsed.dark[0]).toBe('#aaaaaa')
    expect(parsed.dark[1]).toBe(DEFAULT_TOOLBAR_PALETTE.dark[1])
  })

  it('완전한 데이터 → 그대로 반환', () => {
    const full = {
      light: [
        '#100000',
        '#200000',
        '#300000',
        '#400000',
        '#500000',
        '#600000',
        '#700000',
        '#800000'
      ],
      dark: ['#100001', '#200001', '#300001', '#400001', '#500001', '#600001', '#700001', '#800001']
    }
    const parsed = parseToolbarPalette(JSON.stringify(full))
    expect(parsed.light).toEqual(full.light)
    expect(parsed.dark).toEqual(full.dark)
  })

  it('잘못된 타입 (string 아닌 값) → 해당 슬롯은 default', () => {
    const bad = {
      light: [123, '#222222', null, '#444444', undefined, '#666666', {}, '#888888']
    }
    const parsed = parseToolbarPalette(JSON.stringify(bad))
    expect(parsed.light[0]).toBe(DEFAULT_TOOLBAR_PALETTE.light[0])
    expect(parsed.light[1]).toBe('#222222')
    expect(parsed.light[3]).toBe('#444444')
  })
})

describe('useToolbarPalette', () => {
  it('settings 없음 → DEFAULT 반환', async () => {
    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.palette).toEqual(DEFAULT_TOOLBAR_PALETTE)
  })

  it('save 호출 → settings:set IPC + 낙관적 갱신', async () => {
    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const next = {
      light: [
        '#000001',
        '#000002',
        '#000003',
        '#000004',
        '#000005',
        '#000006',
        '#000007',
        '#000008'
      ] as const,
      dark: DEFAULT_TOOLBAR_PALETTE.dark
    }
    act(() => result.current.save(next))

    await waitFor(() => expect(result.current.palette.light[0]).toBe('#000001'))
    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [key, valueStr] = setMock.mock.calls[0]
    expect(key).toBe('noteToolbarPalette')
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.light[0]).toBe('#000001')
  })

  it('reset 호출 → DEFAULT 로 복원', async () => {
    const custom = {
      light: [
        '#fa0000',
        '#fa0001',
        '#fa0002',
        '#fa0003',
        '#fa0004',
        '#fa0005',
        '#fa0006',
        '#fa0007'
      ],
      dark: DEFAULT_TOOLBAR_PALETTE.dark
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.palette.light[0]).toBe('#fa0000'))

    act(() => result.current.reset())

    await waitFor(() =>
      expect(result.current.palette.light[0]).toBe(DEFAULT_TOOLBAR_PALETTE.light[0])
    )
  })

  it('손상된 IPC 응답 → DEFAULT fallback', async () => {
    getMock.mockResolvedValueOnce({ success: true, data: 'not-json' })
    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.palette).toEqual(DEFAULT_TOOLBAR_PALETTE)
  })
})
