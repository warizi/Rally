/**
 * useToolbarPalette 단위 테스트.
 *
 * IPC mock (window.api.settings) + React Query 동작 + v1→v2 마이그레이션.
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
    const partial = ['#111111', '#222222']
    const parsed = parseToolbarPalette(JSON.stringify(partial))
    expect(parsed[0]).toBe('#111111')
    expect(parsed[1]).toBe('#222222')
    expect(parsed[2]).toBe(DEFAULT_TOOLBAR_PALETTE[2])
  })

  it('완전한 데이터 → 그대로 반환', () => {
    const full = [
      '#100000',
      '#200000',
      '#300000',
      '#400000',
      '#500000',
      '#600000',
      '#700000',
      '#800000'
    ]
    const parsed = parseToolbarPalette(JSON.stringify(full))
    expect(parsed).toEqual(full)
  })

  it('잘못된 타입 (string 아닌 값) → 해당 슬롯은 default', () => {
    const bad = [123, '#222222', null, '#444444', undefined, '#666666', {}, '#888888']
    const parsed = parseToolbarPalette(JSON.stringify(bad))
    expect(parsed[0]).toBe(DEFAULT_TOOLBAR_PALETTE[0])
    expect(parsed[1]).toBe('#222222')
    expect(parsed[3]).toBe('#444444')
  })

  it('v1 형식 (light/dark 분리) → light 채택해서 마이그레이션', () => {
    const v1 = {
      light: ['#aa0000', '#aa0001', '#aa0002'],
      dark: ['#bb0000', '#bb0001', '#bb0002']
    }
    const parsed = parseToolbarPalette(JSON.stringify(v1))
    expect(parsed[0]).toBe('#aa0000') // light 가 채택됨, dark 폐기
    expect(parsed[1]).toBe('#aa0001')
    expect(parsed[3]).toBe(DEFAULT_TOOLBAR_PALETTE[3]) // 빈 slot 은 default
  })

  it('v1 형식이지만 light 만 있고 dark 없을 때 → light 채택', () => {
    const v1 = { light: ['#cc0000', '#cc0001'] }
    const parsed = parseToolbarPalette(JSON.stringify(v1))
    expect(parsed[0]).toBe('#cc0000')
  })

  it('v1 형식이지만 light 없고 dark 만 있을 때 → dark 폴백', () => {
    const v1 = { dark: ['#dd0000', '#dd0001'] }
    const parsed = parseToolbarPalette(JSON.stringify(v1))
    expect(parsed[0]).toBe('#dd0000')
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

    const next = [
      '#000001',
      '#000002',
      '#000003',
      '#000004',
      '#000005',
      '#000006',
      '#000007',
      '#000008'
    ] as const
    act(() => result.current.save(next))

    await waitFor(() => expect(result.current.palette[0]).toBe('#000001'))
    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [key, valueStr] = setMock.mock.calls[0]
    expect(key).toBe('noteToolbarPalette')
    const parsed = JSON.parse(valueStr as string)
    expect(parsed[0]).toBe('#000001')
  })

  it('reset 호출 → DEFAULT 로 복원', async () => {
    const custom = [
      '#fa0000',
      '#fa0001',
      '#fa0002',
      '#fa0003',
      '#fa0004',
      '#fa0005',
      '#fa0006',
      '#fa0007'
    ]
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.palette[0]).toBe('#fa0000'))

    act(() => result.current.reset())

    await waitFor(() => expect(result.current.palette[0]).toBe(DEFAULT_TOOLBAR_PALETTE[0]))
  })

  it('손상된 IPC 응답 → DEFAULT fallback', async () => {
    getMock.mockResolvedValueOnce({ success: true, data: 'not-json' })
    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.palette).toEqual(DEFAULT_TOOLBAR_PALETTE)
  })

  it('v1 데이터 로드 → 자동 마이그레이션된 v2 반환', async () => {
    const v1 = {
      light: [
        '#11aaaa',
        '#22aaaa',
        '#33aaaa',
        '#44aaaa',
        '#55aaaa',
        '#66aaaa',
        '#77aaaa',
        '#88aaaa'
      ],
      dark: DEFAULT_TOOLBAR_PALETTE
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(v1) })

    const { result } = renderHook(() => useToolbarPalette(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.palette[0]).toBe('#11aaaa'))
    expect(result.current.palette[7]).toBe('#88aaaa')
  })
})
