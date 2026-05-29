/**
 * widgets/canvas/ui/node-content/DefaultNodeContent.test.tsx
 *
 * refTitle / refPreview 노출 + 빈 title 시 fallback.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DefaultNodeContent } from '../DefaultNodeContent'

describe('DefaultNodeContent', () => {
  it('refTitle 노출', () => {
    render(<DefaultNodeContent refTitle="Note title" refPreview="" />)
    expect(screen.getByText('Note title')).toBeInTheDocument()
  })

  it('refPreview 가 있으면 추가 텍스트 노출', () => {
    render(<DefaultNodeContent refTitle="t" refPreview="preview text" />)
    expect(screen.getByText('preview text')).toBeInTheDocument()
  })

  it('refTitle 빈 문자열 → "(제목 없음)" fallback', () => {
    render(<DefaultNodeContent refTitle="" refPreview="" />)
    expect(screen.getByText('(제목 없음)')).toBeInTheDocument()
  })

  it('refPreview 가 비어있으면 preview 노드 미렌더', () => {
    const { container } = render(<DefaultNodeContent refTitle="t" refPreview="" />)
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })
})
