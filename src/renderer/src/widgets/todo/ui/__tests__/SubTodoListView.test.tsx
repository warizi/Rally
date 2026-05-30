/**
 * widgets/todo/ui/SubTodoListView.test.tsx
 *
 * subTodos 매핑 → SubTodoItem 렌더. 빈 목록 → 빈 row.
 * "+ 하위 할 일 추가" 노출. (DnD 자체는 jsdom 에서 한계 — smoke 만)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="overlay">{children}</div>
  ),
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn()
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(arr: T[]) => arr,
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {}
}))

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useReorderTodoSub: () => ({ mutate: vi.fn() })
}))

vi.mock('../CreateTodoDialog', () => ({
  CreateTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>
}))

vi.mock('../SubTodoItem', () => ({
  SubTodoItem: ({ sub }: { sub: { id: string; title: string } }) => (
    <tr data-testid={`sub-${sub.id}`}>
      <td>{sub.title}</td>
    </tr>
  )
}))

import { SubTodoListView } from '../SubTodoListView'

describe('SubTodoListView', () => {
  it('빈 subTodos → SubTodoItem 미렌더', () => {
    render(<SubTodoListView subTodos={[]} workspaceId="ws" parentId="p" />)
    expect(screen.queryByTestId(/^sub-/)).not.toBeInTheDocument()
  })

  it('subTodos 매핑 → 각 SubTodoItem 렌더', () => {
    render(
      <SubTodoListView
        subTodos={
          [
            { id: 's1', title: 'A' },
            { id: 's2', title: 'B' }
          ] as unknown as Parameters<typeof SubTodoListView>[0]['subTodos']
        }
        workspaceId="ws"
        parentId="p"
      />
    )
    expect(screen.getByTestId('sub-s1')).toBeInTheDocument()
    expect(screen.getByTestId('sub-s2')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('빈 목록 → CreateTodoDialog trigger 안내문 노출', () => {
    render(<SubTodoListView subTodos={[]} workspaceId="ws" parentId="p" />)
    expect(screen.getByText(/하위 할 일을 추가하세요/)).toBeInTheDocument()
  })

  it('subTodos 있음 → CreateTodoDialog 안내 미노출', () => {
    render(
      <SubTodoListView
        subTodos={
          [{ id: 's1', title: 'A' }] as unknown as Parameters<typeof SubTodoListView>[0]['subTodos']
        }
        workspaceId="ws"
        parentId="p"
      />
    )
    expect(screen.queryByText(/하위 할 일을 추가하세요/)).toBeNull()
  })

  it('table 헤더 (제목 라벨) 노출', () => {
    render(<SubTodoListView subTodos={[]} workspaceId="ws" parentId="p" />)
    expect(screen.getByText('제목')).toBeInTheDocument()
  })

  it('DragOverlay 컨테이너 노출 (activeSub=null)', () => {
    render(<SubTodoListView subTodos={[]} workspaceId="ws" parentId="p" />)
    expect(screen.getByTestId('overlay')).toBeInTheDocument()
  })

  it('빈 subTodos → DragOverlay 안에 콘텐츠 없음 (activeSub=null)', () => {
    render(<SubTodoListView subTodos={[]} workspaceId="ws" parentId="p" />)
    const overlay = screen.getByTestId('overlay')
    // activeSub=null → null 자식
    expect(overlay.children.length).toBe(0)
  })

  it('subTodos 3개 → SubTodoItem 3개 + table 헤더 정상', () => {
    render(
      <SubTodoListView
        subTodos={
          [
            { id: 's1', title: 'X1' },
            { id: 's2', title: 'X2' },
            { id: 's3', title: 'X3' }
          ] as unknown as Parameters<typeof SubTodoListView>[0]['subTodos']
        }
        workspaceId="ws"
        parentId="p"
      />
    )
    expect(screen.getAllByTestId(/^sub-/)).toHaveLength(3)
    expect(screen.getByText('제목')).toBeInTheDocument()
  })

  it('parentId / workspaceId prop 정상 전달 (smoke — empty case CreateTodoDialog)', () => {
    render(<SubTodoListView subTodos={[]} workspaceId="ws-x" parentId="parent-1" />)
    // CreateTodoDialog mock 이 trigger 만 렌더 → 안내 버튼 노출
    expect(screen.getByText(/버튼을 눌러/)).toBeInTheDocument()
  })

  it('parent ID/workspaceId 다른 값 → smoke 정상 렌더', () => {
    render(
      <SubTodoListView
        subTodos={
          [{ id: 's1', title: 'OnlyOne' }] as unknown as Parameters<
            typeof SubTodoListView
          >[0]['subTodos']
        }
        workspaceId="ws-other"
        parentId="parent-other"
      />
    )
    expect(screen.getByText('OnlyOne')).toBeInTheDocument()
  })
})
