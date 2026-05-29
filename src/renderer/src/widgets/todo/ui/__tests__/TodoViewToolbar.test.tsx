/**
 * widgets/todo/ui/TodoViewToolbar.test.tsx
 *
 * view=list/kanban 분기 → 활성 버튼 secondary/ghost variant.
 * 버튼 클릭 → onViewChange. workspaceId 있음 → CreateTodoDialog trigger 노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../CreateTodoDialog', () => ({
  CreateTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>
}))

import { TodoViewToolbar } from '../TodoViewToolbar'

describe('TodoViewToolbar', () => {
  it('view=list → 2 view 버튼만 (workspaceId=null)', () => {
    render(<TodoViewToolbar view="list" onViewChange={vi.fn()} workspaceId={null} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('workspaceId 있음 → CreateTodoDialog trigger ("+ 추가") 추가', () => {
    render(<TodoViewToolbar view="list" onViewChange={vi.fn()} workspaceId="ws-1" />)
    expect(screen.getByRole('button', { name: '+ 추가' })).toBeInTheDocument()
  })

  it('첫 번째 (list) 버튼 클릭 → onViewChange("list")', () => {
    const fn = vi.fn()
    render(<TodoViewToolbar view="kanban" onViewChange={fn} workspaceId={null} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(fn).toHaveBeenCalledWith('list')
  })

  it('두 번째 (kanban) 버튼 클릭 → onViewChange("kanban")', () => {
    const fn = vi.fn()
    render(<TodoViewToolbar view="list" onViewChange={fn} workspaceId={null} />)
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(fn).toHaveBeenCalledWith('kanban')
  })
})
