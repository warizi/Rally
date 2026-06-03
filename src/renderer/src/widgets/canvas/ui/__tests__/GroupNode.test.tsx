/**
 * widgets/canvas/ui/GroupNode.test.tsx
 *
 * 노트 요구사항 검증: 점선 테두리 + 반투명 배경 + 라벨.
 * 라벨 더블클릭 편집 → blur 시 변경 있으면 updateGroup mutate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn()
}))

vi.mock('@xyflow/react', () => ({
  NodeResizer: () => null
}))

vi.mock('@entities/canvas', () => ({
  useUpdateCanvasGroup: () => ({ mutate: mocks.mutate })
}))

import { GroupNode } from '../GroupNode'

const baseProps = {
  id: 'g1',
  selected: false,
  data: { nodeType: 'group', label: '작업 그룹', canvasId: 'c1', color: null, width: 300, height: 200 }
} as unknown as Parameters<typeof GroupNode>[0]

beforeEach(() => {
  mocks.mutate.mockReset()
})

describe('GroupNode', () => {
  it('라벨 노출', () => {
    render(<GroupNode {...baseProps} />)
    expect(screen.getByText('작업 그룹')).toBeInTheDocument()
  })

  it('점선 테두리(border-dashed) 적용', () => {
    const { container } = render(<GroupNode {...baseProps} />)
    expect(container.innerHTML).toMatch(/border-dashed/)
  })

  it('라벨 없으면 기본 "그룹" 표시', () => {
    const noLabel = {
      ...baseProps,
      data: { ...baseProps.data, label: null }
    } as unknown as Parameters<typeof GroupNode>[0]
    render(<GroupNode {...noLabel} />)
    expect(screen.getByText('그룹')).toBeInTheDocument()
  })

  it('selected=true → ring-2 ring-primary 클래스', () => {
    const sel = { ...baseProps, selected: true } as unknown as Parameters<typeof GroupNode>[0]
    const { container } = render(<GroupNode {...sel} />)
    expect(container.innerHTML).toMatch(/ring-2/)
  })

  it('라벨 더블클릭 → input 편집 모드', () => {
    render(<GroupNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByText('작업 그룹'))
    expect(screen.getByRole('textbox')).toHaveValue('작업 그룹')
  })

  it('편집 후 blur, 값 변경 → updateGroup.mutate({label})', () => {
    render(<GroupNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByText('작업 그룹'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '새 그룹' } })
    fireEvent.blur(input)
    expect(mocks.mutate).toHaveBeenCalledWith({
      groupId: 'g1',
      data: { label: '새 그룹' },
      canvasId: 'c1'
    })
  })

  it('편집 후 라벨을 비우면 → label:null 로 저장', () => {
    render(<GroupNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByText('작업 그룹'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(mocks.mutate).toHaveBeenCalledWith({
      groupId: 'g1',
      data: { label: null },
      canvasId: 'c1'
    })
  })

  it('값 동일 → mutate 호출 안 함', () => {
    render(<GroupNode {...baseProps} />)
    fireEvent.doubleClick(screen.getByText('작업 그룹'))
    fireEvent.blur(screen.getByRole('textbox'))
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
})
