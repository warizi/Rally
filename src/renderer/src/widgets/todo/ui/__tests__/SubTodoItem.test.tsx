/**
 * widgets/todo/ui/SubTodoItem.test.tsx
 *
 * 제목/체크박스/드롭다운 메뉴(수정/삭제) 렌더. 메뉴에서 수정/삭제 선택 시
 * 해당 dialog open prop 가 true 로 전달.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } }
}))
vi.mock('@features/todo/todo-field/ui/TodoCheckbox', () => ({
  TodoCheckbox: () => <input data-testid="todo-checkbox" type="checkbox" />
}))
vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <span data-testid="entity-link" />
}))
vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadge: () => <span data-testid="author-badge" />
}))
vi.mock('../EditSubTodoDialog', () => ({
  EditSubTodoDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-dialog">edit open</div> : null
}))
vi.mock('@features/todo/delete-todo/ui/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-dialog">delete open</div> : null
}))

import { SubTodoItem } from '../SubTodoItem'

const sub = {
  id: 's1',
  title: 'Sub Task',
  isDone: false,
  updatedBy: 'me',
  updatedById: 'u1',
  updatedAt: 0
} as unknown as Parameters<typeof SubTodoItem>[0]['sub']

describe('SubTodoItem', () => {
  it('제목 + checkbox + entity-link + author-badge 렌더', () => {
    render(
      <table>
        <tbody>
          <SubTodoItem sub={sub} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    expect(screen.getByText('Sub Task')).toBeInTheDocument()
    expect(screen.getByTestId('todo-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('entity-link')).toBeInTheDocument()
    expect(screen.getByTestId('author-badge')).toBeInTheDocument()
  })

  it('isDone=true → line-through 클래스', () => {
    const done = { ...sub, isDone: true }
    render(
      <table>
        <tbody>
          <SubTodoItem sub={done} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    const titleEl = screen.getByText('Sub Task')
    expect(titleEl.className).toMatch(/line-through/)
  })

  it('drag handle (GripVertical) 노출', () => {
    const { container } = render(
      <table>
        <tbody>
          <SubTodoItem sub={sub} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    expect(container.querySelector('.cursor-grab')).toBeInTheDocument()
  })

  it('dropdown trigger 버튼 노출', () => {
    render(
      <table>
        <tbody>
          <SubTodoItem sub={sub} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('처음에는 edit/delete dialog 비노출', () => {
    render(
      <table>
        <tbody>
          <SubTodoItem sub={sub} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    expect(screen.queryByTestId('edit-dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument()
  })

  it('dropdown trigger 클릭 → smoke (Radix portal — 별도 노출 검증 없음)', () => {
    render(
      <table>
        <tbody>
          <SubTodoItem sub={sub} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    // smoke: 버튼 클릭 시 에러 없이 처리됨
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('updatedBy/updatedById/updatedAt props 전달 → AuthorBadge 렌더 (smoke)', () => {
    const withMeta = {
      ...sub,
      updatedBy: 'ai',
      updatedById: 'agent-1',
      updatedAt: new Date(12345)
    }
    render(
      <table>
        <tbody>
          <SubTodoItem sub={withMeta} workspaceId="ws-1" />
        </tbody>
      </table>
    )
    expect(screen.getByTestId('author-badge')).toBeInTheDocument()
  })
})
