/**
 * widgets/todo/ui/SubTodoSection.test.tsx
 *
 * isOpen 분기 → SubTodoListView 노출/숨김. 토글 버튼 → onOpenChange.
 * 카운트 라벨 (0개 → 라벨만, N개 → ` (N)`).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../CreateTodoDialog', () => ({
  CreateTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>
}))

vi.mock('../SubTodoListView', () => ({
  SubTodoListView: () => <div data-testid="sub-todo-list" />
}))

import { SubTodoSection } from '../SubTodoSection'

const baseTodo = { id: 't1' } as unknown as Parameters<typeof SubTodoSection>[0]['todo']

describe('SubTodoSection', () => {
  it('isOpen=true → SubTodoListView 노출 + ChevronDown', () => {
    render(
      <SubTodoSection
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        isOpen={true}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('sub-todo-list')).toBeInTheDocument()
    expect(screen.getAllByText(/하위 할 일/).length).toBeGreaterThan(0)
  })

  it('isOpen=false → SubTodoListView 미노출', () => {
    render(
      <SubTodoSection
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        isOpen={false}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.queryByTestId('sub-todo-list')).not.toBeInTheDocument()
  })

  it('subTodos 비었음 → 라벨에 카운트 없음', () => {
    render(
      <SubTodoSection
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        isOpen={false}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.getByText('하위 할 일')).toBeInTheDocument()
  })

  it('subTodos N개 → "하위 할 일 (N)" 노출', () => {
    render(
      <SubTodoSection
        todo={baseTodo}
        subTodos={
          [{ id: 's1' }, { id: 's2' }] as unknown as Parameters<
            typeof SubTodoSection
          >[0]['subTodos']
        }
        workspaceId="ws"
        isOpen={false}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.getByText('하위 할 일 (2)')).toBeInTheDocument()
  })

  it('토글 버튼 클릭 → onOpenChange(!isOpen)', () => {
    const onOpenChange = vi.fn()
    render(
      <SubTodoSection
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        isOpen={false}
        onOpenChange={onOpenChange}
      />
    )
    // 토글 버튼은 첫 번째 매치 (heading button); "+ 하위 할 일 추가" 는 두 번째
    fireEvent.click(screen.getAllByText(/하위 할 일/)[0])
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('"+ 하위 할 일 추가" 버튼 노출 (CreateTodoDialog trigger)', () => {
    render(
      <SubTodoSection
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        isOpen={false}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /\+ 하위 할 일 추가/ })).toBeInTheDocument()
  })
})
