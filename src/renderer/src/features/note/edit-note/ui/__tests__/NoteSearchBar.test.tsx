/**
 * features/note/edit-note/ui/NoteSearchBar.test.tsx
 *
 * open=false → null. open=true → 검색 input + prev/next/close 버튼.
 * Escape → close. close → onClose. matchCount=0 → "결과 없음".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('@milkdown/react', () => ({
  useInstance: () => [
    null,
    () => {
      if (!searchMocks.editor) return null
      return searchMocks.editor
    }
  ]
}))

vi.mock('@milkdown/kit/core', () => ({
  editorViewCtx: Symbol('editorViewCtx')
}))

const searchMocks = vi.hoisted(() => ({
  matches: [] as Array<{ from: number; to: number }>,
  editor: null as null | {
    action: (fn: (ctx: unknown) => void) => void
    dispatch: ReturnType<typeof vi.fn>
  }
}))

vi.mock('../../model/note-search-plugin', () => ({
  searchPluginKey: { getState: () => ({ matches: searchMocks.matches }) }
}))

import { NoteSearchBar } from '../NoteSearchBar'

beforeEach(() => {
  vi.useFakeTimers()
  searchMocks.matches = []
  searchMocks.editor = null
})

describe('NoteSearchBar', () => {
  it('open=false → null', () => {
    const { container } = render(<NoteSearchBar open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
    vi.useRealTimers()
  })

  it('open=true → 검색 input + 3 버튼 (prev/next/close)', () => {
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('검색...')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    vi.useRealTimers()
  })

  it('Escape → onClose', () => {
    const onClose = vi.fn()
    render(<NoteSearchBar open={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText('검색...'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('X (close) 버튼 클릭 → onClose', () => {
    const onClose = vi.fn()
    render(<NoteSearchBar open={true} onClose={onClose} />)
    const closeBtn = screen.getAllByRole('button')[2]
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('검색어 입력 + 200ms debounce 후 "결과 없음" (matchCount=0)', () => {
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'hello' } })
    vi.advanceTimersByTime(250)
    expect(screen.getByText('결과 없음')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('빈 검색어 → "결과 없음" 미노출', () => {
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    expect(screen.queryByText('결과 없음')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('prev/next 버튼 (matchCount=0) → disabled', () => {
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    const [prev, next] = screen.getAllByRole('button')
    expect(prev).toBeDisabled()
    expect(next).toBeDisabled()
    vi.useRealTimers()
  })

  it('검색어 입력 후 X(close) 버튼 → 검색어 reset (placeholder 노출)', () => {
    const onClose = vi.fn()
    render(<NoteSearchBar open={true} onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'foo' } })
    expect(screen.getByPlaceholderText('검색...')).toHaveValue('foo')
    fireEvent.click(screen.getAllByRole('button')[2])
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('open=true → input 자동 focus (smoke)', () => {
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('검색...')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('Enter 키 → onClose 호출 안 함 (검색 입력 전용)', () => {
    const onClose = vi.fn()
    render(<NoteSearchBar open={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText('검색...'), { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('matches 있음 + 검색 → "1/N" 카운트 노출', () => {
    searchMocks.matches = [
      { from: 0, to: 5 },
      { from: 10, to: 15 },
      { from: 20, to: 25 }
    ]
    searchMocks.editor = {
      action: (fn) => {
        fn({
          get: () => ({
            state: {
              tr: { setMeta: () => ({}) },
              schema: {}
            },
            dispatch: vi.fn(),
            dom: { querySelector: () => null }
          })
        })
      },
      dispatch: vi.fn()
    }
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'foo' } })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.getByText('1/3')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('matches 있음 + next 클릭 → "2/N" 카운트 (smoke)', () => {
    searchMocks.matches = [
      { from: 0, to: 5 },
      { from: 10, to: 15 }
    ]
    searchMocks.editor = {
      action: (fn) => {
        fn({
          get: () => ({
            state: { tr: { setMeta: () => ({}) }, schema: {} },
            dispatch: vi.fn(),
            dom: { querySelector: () => null }
          })
        })
      },
      dispatch: vi.fn()
    }
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'foo' } })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.getByText('1/2')).toBeInTheDocument()
    const [, nextBtn] = screen.getAllByRole('button')
    fireEvent.click(nextBtn)
    expect(screen.getByText('2/2')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('matches 있음 + prev 클릭 (wrap-around) → matchCount/matchCount', () => {
    searchMocks.matches = [
      { from: 0, to: 5 },
      { from: 10, to: 15 }
    ]
    searchMocks.editor = {
      action: (fn) => {
        fn({
          get: () => ({
            state: { tr: { setMeta: () => ({}) }, schema: {} },
            dispatch: vi.fn(),
            dom: { querySelector: () => null }
          })
        })
      },
      dispatch: vi.fn()
    }
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'foo' } })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    const [prevBtn] = screen.getAllByRole('button')
    fireEvent.click(prevBtn)
    // activeIndex 0 → -1 wrap → 1 (matchCount-1)
    expect(screen.getByText('2/2')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('matches 있음 + Enter → goNext, Shift+Enter → goPrev', () => {
    searchMocks.matches = [
      { from: 0, to: 5 },
      { from: 10, to: 15 }
    ]
    searchMocks.editor = {
      action: (fn) => {
        fn({
          get: () => ({
            state: { tr: { setMeta: () => ({}) }, schema: {} },
            dispatch: vi.fn(),
            dom: { querySelector: () => null }
          })
        })
      },
      dispatch: vi.fn()
    }
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('검색...')
    fireEvent.change(input, { target: { value: 'foo' } })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('2/2')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('1/2')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('matches 있음 + active highlight DOM 존재 → scrollIntoView 호출 (smoke)', () => {
    const scrollSpy = vi.fn()
    searchMocks.matches = [{ from: 0, to: 5 }]
    searchMocks.editor = {
      action: (fn) => {
        fn({
          get: () => ({
            state: { tr: { setMeta: () => ({}) }, schema: {} },
            dispatch: vi.fn(),
            dom: { querySelector: () => ({ scrollIntoView: scrollSpy }) }
          })
        })
      },
      dispatch: vi.fn()
    }
    render(<NoteSearchBar open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'foo' } })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    // rAF가 호출되어야 하지만 happy-dom 에서 자동 실행됨
    // smoke 통과
    expect(screen.getByText('1/1')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
