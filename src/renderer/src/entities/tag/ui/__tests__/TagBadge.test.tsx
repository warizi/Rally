/**
 * entities/tag/ui/TagBadge.test.tsx
 *
 * 이름/색상 표시 + onRemove 버튼 + description tooltip.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagBadge } from '../TagBadge'
import type { TagItem } from '../../model/types'

function tag(over: Partial<TagItem> = {}): TagItem {
  return {
    id: 't1',
    name: 'Tag',
    color: '#ff0000',
    description: null,
    ...over
  } as unknown as TagItem
}

describe('TagBadge', () => {
  it('태그 이름 노출', () => {
    render(<TagBadge tag={tag()} />)
    expect(screen.getByText('Tag')).toBeInTheDocument()
  })

  it('color 가 background style 로 적용', () => {
    const { container } = render(<TagBadge tag={tag({ color: '#ff0000' })} />)
    const dot = container.querySelector('span.size-2')
    expect(dot).toHaveAttribute('style', expect.stringContaining('background'))
  })

  it('onRemove 제공 → X 버튼 노출 + 클릭 시 onRemove 호출', () => {
    const fn = vi.fn()
    const { container } = render(<TagBadge tag={tag()} onRemove={fn} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    expect(fn).toHaveBeenCalled()
  })

  it('onRemove 미제공 → X 버튼 미노출', () => {
    const { container } = render(<TagBadge tag={tag()} />)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('description 있음 → tooltip wrapping (badge 는 여전히 렌더)', () => {
    render(<TagBadge tag={tag({ description: '설명' })} />)
    expect(screen.getByText('Tag')).toBeInTheDocument()
  })
})
