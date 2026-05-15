/**
 * NoteToolbarPaletteSection 단위 테스트.
 *
 * 단일 8 slot 단순화 후 — 모드 전환 / light/dark 분리 제거.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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
    const colorInputs = slots.querySelectorAll('input[type="color"]')
    expect(colorInputs).toHaveLength(8)
  })

  it('기본값 색상으로 시작 (slot 1 = DEFAULT[0])', async () => {
    const { wrapper } = createWrapper()
    render(<NoteToolbarPaletteSection />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).toBeNull()
    })

    const slots = screen.getByTestId('palette-slots')
    const firstHexInput = slots.querySelectorAll('input.font-mono')[0] as HTMLInputElement
    expect(firstHexInput.value.toLowerCase()).toBe(DEFAULT_TOOLBAR_PALETTE[0].toLowerCase())
  })

  it('슬롯 색상 변경 → settings:set IPC + 올바른 hex 직렬화', async () => {
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
    expect(parsed[0]).toBe('#abcdef')
    expect(parsed[1]).toBe(DEFAULT_TOOLBAR_PALETTE[1])
  })

  it('슬롯별 초기화 → 해당 slot 만 default', async () => {
    const custom = [
      '#000001',
      '#000002',
      '#000003',
      '#000004',
      '#000005',
      '#000006',
      '#000007',
      '#000008'
    ]
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
    expect(parsed[0]).toBe(DEFAULT_TOOLBAR_PALETTE[0])
    expect(parsed[1]).toBe('#000002')
  })

  it('전체 초기화 → 모든 슬롯 DEFAULT', async () => {
    const custom = [
      '#aa0001',
      '#aa0002',
      '#aa0003',
      '#aa0004',
      '#aa0005',
      '#aa0006',
      '#aa0007',
      '#aa0008'
    ]
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
    expect(parsed).toEqual([...DEFAULT_TOOLBAR_PALETTE])
  })

  it('hex 텍스트 input 으로도 편집 가능', async () => {
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
    expect(parsed[0]).toBe('#deadbe')
  })
})
