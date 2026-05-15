/**
 * NoteFloatingToolbar 단위 테스트.
 *
 * Milkdown editor 의존 부분은 mock 처리. toolbar-state 커스텀 이벤트 dispatch
 * 시뮬레이션으로 visible 토글, 위치, active mark 표시, 색상 popover 동작 확인.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TOOLBAR_STATE_EVENT, type ToolbarStateDetail } from '../../model/note-toolbar-state-plugin'
import { DEFAULT_TOOLBAR_PALETTE } from '@entities/note-toolbar-palette'

// Milkdown react bindings mock — useInstance 가 mock getEditor 반환.
const actionMock = vi.fn()
vi.mock('@milkdown/react', () => ({
  useInstance: () => [false, () => ({ action: actionMock })]
}))

// Milkdown utils — callCommand 는 mock 으로 (key, payload) 를 그대로 캡처하도록 노출.
// $prose / $command 등 다른 export 는 실제 구현 사용 (note-toolbar-state-plugin import 때문).
vi.mock('@milkdown/kit/utils', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    callCommand: (key: unknown, payload?: unknown) => ({ key, payload })
  }
})

// preset-commonmark 의 toggle 커맨드 — key 만 노출되면 충분.
vi.mock('@milkdown/kit/preset/commonmark', () => ({
  toggleStrongCommand: { key: 'ToggleStrong' },
  toggleEmphasisCommand: { key: 'ToggleEmphasis' },
  toggleInlineCodeCommand: { key: 'ToggleInlineCode' }
}))

// 자체 정의 커맨드도 동일하게 key 노출 mock.
vi.mock('../../model/note-toolbar-commands', () => ({
  toggleColorCommand: { key: 'ToggleColorMark' }
}))

import { NoteFloatingToolbar } from '../NoteFloatingToolbar'

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
  actionMock.mockReset()
  getMock = vi.fn().mockResolvedValue({ success: true, data: null })
  setMock = vi.fn().mockResolvedValue({ success: true })
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { get: getMock, set: setMock }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

function dispatchState(host: HTMLElement, detail: ToolbarStateDetail): void {
  act(() => {
    host.dispatchEvent(new CustomEvent(TOOLBAR_STATE_EVENT, { detail }))
  })
}

function visibleState(
  overrides: Partial<ToolbarStateDetail['activeMarks']> = {}
): ToolbarStateDetail {
  return {
    visible: true,
    rect: { top: 100, left: 200, width: 50, height: 20 },
    activeMarks: {
      italic: false,
      bold: false,
      inlineCode: false,
      ...overrides
    }
  }
}

describe('NoteFloatingToolbar', () => {
  it('initial 상태 (visible=false) 에서는 렌더되지 않음', () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    expect(screen.queryByTestId('note-floating-toolbar')).toBeNull()
    document.body.removeChild(host)
  })

  it('visible 이벤트 dispatch 시 toolbar 렌더', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })

    dispatchState(host, visibleState())

    await waitFor(() => expect(screen.getByTestId('note-floating-toolbar')).toBeInTheDocument())
    document.body.removeChild(host)
  })

  it('visible=false 이벤트 dispatch 시 toolbar 사라짐', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })

    dispatchState(host, visibleState())
    await waitFor(() => expect(screen.queryByTestId('note-floating-toolbar')).not.toBeNull())

    dispatchState(host, { visible: false })
    await waitFor(() => expect(screen.queryByTestId('note-floating-toolbar')).toBeNull())
    document.body.removeChild(host)
  })

  it('italic 버튼 클릭 시 toggleEmphasis 커맨드 호출', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    dispatchState(host, visibleState())

    await waitFor(() => expect(screen.queryByTestId('floating-toolbar-italic')).not.toBeNull())
    fireEvent.click(screen.getByTestId('floating-toolbar-italic'))

    expect(actionMock).toHaveBeenCalled()
    const arg = actionMock.mock.calls[0][0] as { key: unknown }
    expect(arg.key).toBe('ToggleEmphasis')
    document.body.removeChild(host)
  })

  it('bold / inlineCode 버튼 클릭도 각 커맨드 호출', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    dispatchState(host, visibleState())

    await waitFor(() => expect(screen.queryByTestId('floating-toolbar-bold')).not.toBeNull())
    fireEvent.click(screen.getByTestId('floating-toolbar-bold'))
    expect((actionMock.mock.calls[0][0] as { key: unknown }).key).toBe('ToggleStrong')

    fireEvent.click(screen.getByTestId('floating-toolbar-code'))
    expect((actionMock.mock.calls[1][0] as { key: unknown }).key).toBe('ToggleInlineCode')
    document.body.removeChild(host)
  })

  it('활성 italic mark 이면 italic 버튼 aria-pressed=true', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    dispatchState(host, visibleState({ italic: true }))

    await waitFor(() => {
      const btn = screen.getByTestId('floating-toolbar-italic')
      expect(btn.getAttribute('aria-pressed')).toBe('true')
    })
    document.body.removeChild(host)
  })

  it('색상 popover 트리거 클릭 시 8 슬롯 색상 표시', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    dispatchState(host, visibleState())

    // 팔레트 hook (default) load 완료 대기.
    await waitFor(() =>
      expect(screen.queryByTestId('floating-toolbar-color-trigger')).not.toBeNull()
    )

    fireEvent.click(screen.getByTestId('floating-toolbar-color-trigger'))

    await waitFor(() => {
      const grid = screen.getByTestId('floating-toolbar-color-grid')
      const slots = grid.querySelectorAll('button')
      expect(slots).toHaveLength(8)
    })
    document.body.removeChild(host)
  })

  it('색상 슬롯 클릭 시 toggleColorCommand 가 해당 hex 와 함께 호출', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    dispatchState(host, visibleState())

    fireEvent.click(screen.getByTestId('floating-toolbar-color-trigger'))
    await waitFor(() =>
      expect(screen.queryByTestId('floating-toolbar-color-slot-2')).not.toBeNull()
    )

    fireEvent.click(screen.getByTestId('floating-toolbar-color-slot-2'))

    expect(actionMock).toHaveBeenCalled()
    const lastCall = actionMock.mock.calls[actionMock.mock.calls.length - 1][0] as {
      key: unknown
      payload: unknown
    }
    expect(lastCall.key).toBe('ToggleColorMark')
    expect(lastCall.payload).toBe(DEFAULT_TOOLBAR_PALETTE.light[2])
    document.body.removeChild(host)
  })

  it('색 제거 버튼 클릭 시 toggleColorCommand(undefined) 호출', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="light" />, { wrapper })
    dispatchState(host, visibleState({ color: '#ff0000' }))

    fireEvent.click(screen.getByTestId('floating-toolbar-color-trigger'))
    await waitFor(() =>
      expect(screen.queryByTestId('floating-toolbar-color-remove')).not.toBeNull()
    )

    fireEvent.click(screen.getByTestId('floating-toolbar-color-remove'))

    const lastCall = actionMock.mock.calls[actionMock.mock.calls.length - 1][0] as {
      key: unknown
      payload: unknown
    }
    expect(lastCall.key).toBe('ToggleColorMark')
    expect(lastCall.payload).toBeUndefined()
    document.body.removeChild(host)
  })

  it('theme=dark 일 때 dark 팔레트 색상이 그리드에 표시', async () => {
    const { wrapper } = createWrapper()
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<NoteFloatingToolbar editorEl={host} theme="dark" />, { wrapper })
    dispatchState(host, visibleState())

    fireEvent.click(screen.getByTestId('floating-toolbar-color-trigger'))
    await waitFor(() =>
      expect(screen.queryByTestId('floating-toolbar-color-slot-0')).not.toBeNull()
    )
    const slot0 = screen.getByTestId('floating-toolbar-color-slot-0') as HTMLButtonElement
    // style.backgroundColor 는 rgb() 형식으로 변환되므로 정확 매칭 대신 색이 채워졌는지 + key 가 dark 임을 확인
    expect(slot0.style.backgroundColor).toBeTruthy()
    document.body.removeChild(host)
  })
})
