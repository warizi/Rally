/**
 * features/csv/edit-csv/ui/CsvToolbar.test.tsx
 *
 * 행/열 추가, undo/redo disabled, 검색 키보드 (Enter/Shift+Enter/Escape), Cmd+F focus.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CsvToolbar } from '../CsvToolbar'

type Props = React.ComponentProps<typeof CsvToolbar>

function baseProps(over: Partial<Props> = {}): Props {
  return {
    rowCount: 10,
    colCount: 5,
    isDirty: false,
    canUndo: true,
    canRedo: true,
    onAddRow: vi.fn(),
    onAddColumn: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    onSearchNext: vi.fn(),
    onSearchPrev: vi.fn(),
    searchMatchCount: 0,
    searchCurrentIndex: 0,
    ...over
  }
}

describe('CsvToolbar', () => {
  it('row/col count 노출', () => {
    render(<CsvToolbar {...baseProps()} />)
    expect(screen.getByText('5열 × 10행')).toBeInTheDocument()
  })

  it('isDirty=true → "저장 중..." 노출', () => {
    render(<CsvToolbar {...baseProps({ isDirty: true })} />)
    expect(screen.getByText('저장 중...')).toBeInTheDocument()
  })

  it('canUndo=false → undo 버튼 disabled', () => {
    const { container } = render(<CsvToolbar {...baseProps({ canUndo: false })} />)
    const undoBtn = container.querySelector('button:has(.lucide-undo-2)') as HTMLButtonElement
    expect(undoBtn).toBeDisabled()
  })

  it('canRedo=false → redo 버튼 disabled', () => {
    const { container } = render(<CsvToolbar {...baseProps({ canRedo: false })} />)
    const redoBtn = container.querySelector('button:has(.lucide-redo-2)') as HTMLButtonElement
    expect(redoBtn).toBeDisabled()
  })

  it('"행 추가" 클릭 → onAddRow', () => {
    const fn = vi.fn()
    render(<CsvToolbar {...baseProps({ onAddRow: fn })} />)
    fireEvent.click(screen.getByRole('button', { name: /행 추가/ }))
    expect(fn).toHaveBeenCalled()
  })

  it('"열 추가" 클릭 → onAddColumn', () => {
    const fn = vi.fn()
    render(<CsvToolbar {...baseProps({ onAddColumn: fn })} />)
    fireEvent.click(screen.getByRole('button', { name: /열 추가/ }))
    expect(fn).toHaveBeenCalled()
  })

  it('search input 변경 → onSearchQueryChange', () => {
    const fn = vi.fn()
    render(<CsvToolbar {...baseProps({ onSearchQueryChange: fn })} />)
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'hi' } })
    expect(fn).toHaveBeenCalledWith('hi')
  })

  it('Enter → onSearchNext', () => {
    const next = vi.fn()
    render(<CsvToolbar {...baseProps({ onSearchNext: next })} />)
    fireEvent.keyDown(screen.getByPlaceholderText('검색...'), { key: 'Enter' })
    expect(next).toHaveBeenCalled()
  })

  it('Shift+Enter → onSearchPrev', () => {
    const prev = vi.fn()
    render(<CsvToolbar {...baseProps({ onSearchPrev: prev })} />)
    fireEvent.keyDown(screen.getByPlaceholderText('검색...'), { key: 'Enter', shiftKey: true })
    expect(prev).toHaveBeenCalled()
  })

  it('Escape → onSearchQueryChange("")', () => {
    const fn = vi.fn()
    render(<CsvToolbar {...baseProps({ onSearchQueryChange: fn, searchQuery: 'foo' })} />)
    fireEvent.keyDown(screen.getByPlaceholderText('검색...'), { key: 'Escape' })
    expect(fn).toHaveBeenCalledWith('')
  })

  it('searchQuery 있고 matchCount > 0 → "current+1/total" 표시', () => {
    render(
      <CsvToolbar
        {...baseProps({ searchQuery: 'foo', searchMatchCount: 3, searchCurrentIndex: 1 })}
      />
    )
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('searchMatchCount=0 → Prev/Next 버튼 disabled', () => {
    const { container } = render(<CsvToolbar {...baseProps({ searchMatchCount: 0 })} />)
    const upBtn = container.querySelector('button:has(.lucide-chevron-up)') as HTMLButtonElement
    expect(upBtn).toBeDisabled()
  })

  it('Cmd+F (window) → input 포커스 (focus 동작은 jsdom 환경 의존, 호출 자체만 검증)', () => {
    render(<CsvToolbar {...baseProps()} />)
    const ev = new KeyboardEvent('keydown', { key: 'f', metaKey: true })
    Object.defineProperty(ev, 'preventDefault', { value: vi.fn() })
    window.dispatchEvent(ev)
    // 핸들러 동작 확인 — preventDefault 호출됨
    expect(ev.preventDefault as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })
})
