/**
 * widgets/tag/ui/TagPicker.test.tsx
 *
 * Popover trigger + open=true 강제 시 검색/토글/생성 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagPicker } from '../TagPicker'
import type { TagItem } from '@entities/tag'

function tag(id: string, name: string, color = '#000'): TagItem {
  return { id, name, color } as unknown as TagItem
}

describe('TagPicker', () => {
  it('trigger 버튼 노출 (Plus 아이콘)', () => {
    const { container } = render(
      <TagPicker
        allTags={[tag('t1', 'Tag1')]}
        attachedTagIds={new Set()}
        onToggle={vi.fn()}
        onCreateClick={vi.fn()}
      />
    )
    expect(container.querySelector('svg.lucide-plus')).toBeInTheDocument()
  })

  it('trigger 클릭 → Popover 열림 + 태그 목록 노출', () => {
    render(
      <TagPicker
        allTags={[tag('t1', 'Apple'), tag('t2', 'Banana')]}
        attachedTagIds={new Set(['t1'])}
        onToggle={vi.fn()}
        onCreateClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
  })

  it('검색 입력 → filter 적용', () => {
    render(
      <TagPicker
        allTags={[tag('t1', 'Apple'), tag('t2', 'Banana')]}
        attachedTagIds={new Set()}
        onToggle={vi.fn()}
        onCreateClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    const input = screen.getByPlaceholderText('태그 검색...')
    fireEvent.change(input, { target: { value: 'ban' } })
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
  })

  it('태그 클릭 → onToggle 호출', () => {
    const onToggle = vi.fn()
    render(
      <TagPicker
        allTags={[tag('t1', 'X')]}
        attachedTagIds={new Set()}
        onToggle={onToggle}
        onCreateClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button')) // open
    fireEvent.click(screen.getByText('X'))
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
  })

  it('"새 태그 만들기" 클릭 → onCreateClick 호출', () => {
    const onCreate = vi.fn()
    render(
      <TagPicker
        allTags={[]}
        attachedTagIds={new Set()}
        onToggle={vi.fn()}
        onCreateClick={onCreate}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('새 태그 만들기'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('태그 0개 + search 빈값 → "태그가 없습니다"', () => {
    render(
      <TagPicker
        allTags={[]}
        attachedTagIds={new Set()}
        onToggle={vi.fn()}
        onCreateClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('태그가 없습니다')).toBeInTheDocument()
  })
})
