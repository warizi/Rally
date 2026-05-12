/**
 * FolderTreeSearchBar 단위 테스트 (Phase 2).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FolderTreeSearchBar } from '../FolderTreeSearchBar'

function setup(overrides: Partial<React.ComponentProps<typeof FolderTreeSearchBar>> = {}): {
  onQueryChange: ReturnType<typeof vi.fn>
  onNext: ReturnType<typeof vi.fn>
  onPrev: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
} {
  const onQueryChange = vi.fn()
  const onNext = vi.fn()
  const onPrev = vi.fn()
  const onClose = vi.fn()
  render(
    <FolderTreeSearchBar
      open
      query=""
      matchCount={0}
      activeIndex={-1}
      onQueryChange={onQueryChange}
      onNext={onNext}
      onPrev={onPrev}
      onClose={onClose}
      {...overrides}
    />
  )
  return { onQueryChange, onNext, onPrev, onClose }
}

describe('FolderTreeSearchBar', () => {
  it('open=false 면 렌더 안 함', () => {
    const { container } = render(
      <FolderTreeSearchBar
        open={false}
        query=""
        matchCount={0}
        activeIndex={-1}
        onQueryChange={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('input 변경 → onQueryChange 호출', () => {
    const { onQueryChange } = setup()
    fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: 'abc' } })
    expect(onQueryChange).toHaveBeenCalledWith('abc')
  })

  it('Enter → onNext, Shift+Enter → onPrev, Escape → onClose', () => {
    const { onNext, onPrev, onClose } = setup({ query: 'a', matchCount: 2, activeIndex: 0 })
    const input = screen.getByPlaceholderText('검색...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNext).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onPrev).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('↑↓ 버튼 클릭 → onPrev / onNext', () => {
    const { onPrev, onNext } = setup({ query: 'a', matchCount: 2, activeIndex: 0 })
    fireEvent.click(screen.getByLabelText('이전 매치'))
    expect(onPrev).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('다음 매치'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('X 버튼 클릭 → onClose', () => {
    const { onClose } = setup({ query: 'a' })
    fireEvent.click(screen.getByLabelText('검색 닫기'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('매치 카운터 표시: matchCount > 0 → "n/total"', () => {
    setup({ query: 'a', matchCount: 3, activeIndex: 1 })
    expect(screen.getByText('2/3')).toBeInTheDocument() // activeIndex 0-based, 표시는 1-based
  })

  it('매치 0 → "결과 없음"', () => {
    setup({ query: 'xyz', matchCount: 0, activeIndex: -1 })
    expect(screen.getByText('결과 없음')).toBeInTheDocument()
  })

  it('matchCount 0 시 ↑↓ 버튼 disabled', () => {
    setup({ query: 'xyz', matchCount: 0 })
    expect(screen.getByLabelText('이전 매치')).toBeDisabled()
    expect(screen.getByLabelText('다음 매치')).toBeDisabled()
  })

  it('query 비어있으면 카운터 표시 안 함', () => {
    setup({ query: '' })
    expect(screen.queryByText(/결과/)).toBeNull()
    expect(screen.queryByText(/\//)).toBeNull()
  })
})
