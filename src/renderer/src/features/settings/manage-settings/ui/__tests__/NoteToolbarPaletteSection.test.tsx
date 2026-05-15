/**
 * NoteToolbarPaletteSection 단위 테스트.
 *
 * 8 slot 렌더 + 라이트/다크 모드 전환 + 슬롯 편집 → save IPC 전송 + 초기화 동작.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoteToolbarPaletteSection } from '../NoteToolbarPaletteSection'
import { DEFAULT_TOOLBAR_PALETTE } from '@entities/note-toolbar-palette'

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

describe('NoteToolbarPaletteSection', () => {
  it('8개 슬롯 렌더', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    const slots = screen.getByTestId('palette-slots')
    // 각 슬롯은 1 ColorInput (2 input: color + text)
    const colorInputs = slots.querySelectorAll('input[type="color"]')
    expect(colorInputs).toHaveLength(8)
  })

  it('기본값 라이트 모드 색상으로 시작 (slot 1 = gray-800)', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    const slots = screen.getByTestId('palette-slots')
    const firstHexInput = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement
    expect(firstHexInput.value.toLowerCase()).toBe(DEFAULT_TOOLBAR_PALETTE.light[0].toLowerCase())
  })

  it('다크 모드 토글 시 다크 색상으로 전환', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    fireEvent.click(screen.getByText('다크'))

    await waitFor(() => {
      const slots = screen.getByTestId('palette-slots')
      const firstHexInput = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement
      expect(firstHexInput.value.toLowerCase()).toBe(DEFAULT_TOOLBAR_PALETTE.dark[0].toLowerCase())
    })
  })

  it('슬롯 색상 변경 시 settings:set IPC 호출', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    const slots = screen.getByTestId('palette-slots')
    const firstColorInput = slots.querySelectorAll('input[type="color"]')[0] as HTMLInputElement

    act(() => {
      fireEvent.change(firstColorInput, { target: { value: '#abcdef' } })
    })

    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [key, valueStr] = setMock.mock.calls[0]
    expect(key).toBe('noteToolbarPalette')
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.light[0]).toBe('#abcdef')
    // 나머지 slot 은 default 유지
    expect(parsed.light[1]).toBe(DEFAULT_TOOLBAR_PALETTE.light[1])
  })

  it('슬롯별 초기화 버튼 클릭 시 해당 슬롯만 default 로', async () => {
    const custom = {
      light: [
        '#000001',
        '#000002',
        '#000003',
        '#000004',
        '#000005',
        '#000006',
        '#000007',
        '#000008'
      ],
      dark: DEFAULT_TOOLBAR_PALETTE.dark
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      const slots = screen.getByTestId('palette-slots')
      const first = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement
      expect(first.value).toBe('#000001')
    })

    fireEvent.click(screen.getByTestId('palette-slot-reset-0'))

    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [, valueStr] = setMock.mock.calls[0]
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.light[0]).toBe(DEFAULT_TOOLBAR_PALETTE.light[0])
    // 다른 slot 은 custom 유지
    expect(parsed.light[1]).toBe('#000002')
  })

  it('전체 초기화 버튼 클릭 시 모든 슬롯이 DEFAULT 로', async () => {
    const custom = {
      light: [
        '#aa0001',
        '#aa0002',
        '#aa0003',
        '#aa0004',
        '#aa0005',
        '#aa0006',
        '#aa0007',
        '#aa0008'
      ],
      dark: ['#bb0001', '#bb0002', '#bb0003', '#bb0004', '#bb0005', '#bb0006', '#bb0007', '#bb0008']
    }
    getMock.mockResolvedValueOnce({ success: true, data: JSON.stringify(custom) })

    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      const slots = screen.getByTestId('palette-slots')
      const first = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement
      expect(first.value).toBe('#aa0001')
    })

    fireEvent.click(screen.getByTestId('palette-reset-all'))

    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [, valueStr] = setMock.mock.calls[0]
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.light).toEqual([...DEFAULT_TOOLBAR_PALETTE.light])
    expect(parsed.dark).toEqual([...DEFAULT_TOOLBAR_PALETTE.dark])
  })

  it('다크 모드에서 슬롯 편집 시 dark 배열만 업데이트', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    fireEvent.click(screen.getByText('다크'))

    await waitFor(() => {
      const slots = screen.getByTestId('palette-slots')
      const first = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement
      expect(first.value.toLowerCase()).toBe(DEFAULT_TOOLBAR_PALETTE.dark[0].toLowerCase())
    })

    const slots = screen.getByTestId('palette-slots')
    const firstColorInput = slots.querySelectorAll('input[type="color"]')[0] as HTMLInputElement
    act(() => {
      fireEvent.change(firstColorInput, { target: { value: '#cccccc' } })
    })

    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [, valueStr] = setMock.mock.calls[0]
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.dark[0]).toBe('#cccccc')
    // light 는 변경 안 됨
    expect(parsed.light[0]).toBe(DEFAULT_TOOLBAR_PALETTE.light[0])
  })

  it('hex 입력칸으로도 색상 편집 가능', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    const slots = screen.getByTestId('palette-slots')
    const firstHexInput = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement

    act(() => {
      fireEvent.change(firstHexInput, { target: { value: '#deadbe' } })
    })

    await waitFor(() => expect(setMock).toHaveBeenCalled())
    const [, valueStr] = setMock.mock.calls[0]
    const parsed = JSON.parse(valueStr as string)
    expect(parsed.light[0]).toBe('#deadbe')
  })
})

// within 사용을 위해 import 보존 — eslint unused 회피
void within
