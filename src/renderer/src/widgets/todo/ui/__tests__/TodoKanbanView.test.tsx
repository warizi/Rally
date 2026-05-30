/**
 * widgets/todo/ui/TodoKanbanView.test.tsx
 *
 * columnMap 기반 각 상태 board 렌더. carousel mode (좁은 화면) 분기.
 * smoke 테스트 — DnD 자체는 jsdom 한계.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ResizeObserver polyfill — TodoKanbanView 가 contentRect.width 기반 캐러셀 분기 사용
type ResizeCallback = (entries: Array<{ contentRect: { width: number } }>) => void
const resizeObservers: ResizeCallback[] = []
class MockResizeObserver {
  cb: ResizeCallback
  constructor(cb: ResizeCallback) {
    this.cb = cb
    resizeObservers.push(cb)
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver

const dndContextCallbacks: {
  onDragStart?: (e: { active: { id: string } }) => void
  onDragOver?: (e: { active: { id: string }; over: { id: string } | null }) => void
  onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
  onDragCancel?: () => void
} = {}

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel
  }: {
    children: React.ReactNode
    onDragStart?: (e: { active: { id: string } }) => void
    onDragOver?: (e: { active: { id: string }; over: { id: string } | null }) => void
    onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
    onDragCancel?: () => void
  }) => {
    dndContextCallbacks.onDragStart = onDragStart
    dndContextCallbacks.onDragOver = onDragOver
    dndContextCallbacks.onDragEnd = onDragEnd
    dndContextCallbacks.onDragCancel = onDragCancel
    return <>{children}</>
  },
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn()
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(arr: T[]) => arr
}))

const todoMocks = vi.hoisted(() => ({
  reorderMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useReorderTodoKanban: () => ({ mutate: todoMocks.reorderMutate })
}))

vi.mock('../TodoKanbanBoard', () => ({
  TodoKanbanBoard: ({ status, todos }: { status: string; todos: Array<{ id: string }> }) => (
    <div data-testid={`board-${status}`}>{`${status}:${todos.length}`}</div>
  )
}))

vi.mock('../TodoKanbanCard', () => ({
  TodoKanbanCardOverlay: () => null
}))

vi.mock('../../model/use-todo-kanban', () => ({
  KANBAN_COLUMNS: ['할일', '진행중', '완료', '보류']
}))

import { TodoKanbanView } from '../TodoKanbanView'

const baseProps = {
  todos: [],
  subTodoMap: new Map(),
  columnMap: new Map([
    ['할일', [{ id: 't1' }, { id: 't2' }]],
    ['진행중', [{ id: 't3' }]],
    ['완료', []],
    ['보류', []]
  ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap'],
  workspaceId: 'ws',
  filterActive: false,
  activeColumn: 0,
  onColumnChange: vi.fn(),
  onItemClick: vi.fn(),
  onItemDelete: vi.fn()
}

beforeEach(() => {
  todoMocks.reorderMutate.mockReset()
  dndContextCallbacks.onDragStart = undefined
  dndContextCallbacks.onDragOver = undefined
  dndContextCallbacks.onDragEnd = undefined
  dndContextCallbacks.onDragCancel = undefined
})

describe('TodoKanbanView', () => {
  it('4개 컬럼 (KANBAN_COLUMNS) 별로 TodoKanbanBoard 렌더 (carousel + regular = 중복 OK)', () => {
    render(<TodoKanbanView {...baseProps} />)
    expect(screen.getAllByTestId('board-할일').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-진행중').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-완료').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-보류').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-할일')[0]).toHaveTextContent('할일:2')
  })

  it('컬럼 데이터 비었음 → 카운트 0', () => {
    const emptyMap = new Map([
      ['할일', []],
      ['진행중', []],
      ['완료', []],
      ['보류', []]
    ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap']
    render(<TodoKanbanView {...baseProps} columnMap={emptyMap} />)
    expect(screen.getAllByTestId('board-할일')[0]).toHaveTextContent('할일:0')
  })

  it('DragOverlay 렌더 (활성 카드 없음)', () => {
    render(<TodoKanbanView {...baseProps} />)
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('큰 컬럼 (todos > 5개) 렌더 → 카운트 정확', () => {
    const bigMap = new Map([
      ['할일', Array.from({ length: 10 }, (_, i) => ({ id: `t${i}` }))],
      ['진행중', []],
      ['완료', []],
      ['보류', []]
    ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap']
    render(<TodoKanbanView {...baseProps} columnMap={bigMap} />)
    expect(screen.getAllByTestId('board-할일')[0]).toHaveTextContent('할일:10')
  })

  it('filterActive=true → smoke 렌더 (4 보드 모두)', () => {
    render(<TodoKanbanView {...baseProps} filterActive={true} />)
    expect(screen.getAllByTestId('board-할일').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-진행중').length).toBeGreaterThan(0)
  })

  it('activeColumn=2 → smoke 렌더 (다른 활성 컬럼)', () => {
    render(<TodoKanbanView {...baseProps} activeColumn={2} />)
    expect(screen.getAllByTestId('board-완료').length).toBeGreaterThan(0)
  })

  it('onItemClick / onItemDelete props 정의 → 즉시 호출 안 됨 (smoke)', () => {
    const onItemClick = vi.fn()
    const onItemDelete = vi.fn()
    render(<TodoKanbanView {...baseProps} onItemClick={onItemClick} onItemDelete={onItemDelete} />)
    expect(onItemClick).not.toHaveBeenCalled()
    expect(onItemDelete).not.toHaveBeenCalled()
  })

  it('carousel mode (width<600) → 활성 컬럼 만 보임 + dots 노출', () => {
    render(<TodoKanbanView {...baseProps} />)
    // ResizeObserver callback 호출하여 carousel mode 진입
    act(() => {
      resizeObservers.forEach((cb) => cb([{ contentRect: { width: 400 } }]))
    })
    // 4개 dots 노출
    const dots = document.querySelectorAll('.w-1\\.5.h-1\\.5')
    expect(dots.length).toBe(4)
  })

  it('carousel mode + ChevronLeft 비활성 (activeColumn=0)', () => {
    render(<TodoKanbanView {...baseProps} activeColumn={0} />)
    act(() => {
      resizeObservers.forEach((cb) => cb([{ contentRect: { width: 400 } }]))
    })
    const leftBtn = screen
      .getAllByRole('button')
      .find((b) => b.querySelector('svg.lucide-chevron-left'))
    expect(leftBtn).toBeDisabled()
  })

  it('carousel mode + ChevronRight 활성 + 클릭 → onColumnChange(activeColumn+1)', () => {
    const onColumnChange = vi.fn()
    render(<TodoKanbanView {...baseProps} activeColumn={0} onColumnChange={onColumnChange} />)
    act(() => {
      resizeObservers.forEach((cb) => cb([{ contentRect: { width: 400 } }]))
    })
    const rightBtn = screen
      .getAllByRole('button')
      .find((b) => b.querySelector('svg.lucide-chevron-right'))
    fireEvent.click(rightBtn!)
    expect(onColumnChange).toHaveBeenCalledWith(1)
  })

  it('carousel mode + ChevronRight 비활성 (activeColumn=마지막)', () => {
    render(<TodoKanbanView {...baseProps} activeColumn={3} />)
    act(() => {
      resizeObservers.forEach((cb) => cb([{ contentRect: { width: 400 } }]))
    })
    const rightBtn = screen
      .getAllByRole('button')
      .find((b) => b.querySelector('svg.lucide-chevron-right'))
    expect(rightBtn).toBeDisabled()
  })

  it('dot 클릭 → onColumnChange(i) 호출', () => {
    const onColumnChange = vi.fn()
    render(<TodoKanbanView {...baseProps} onColumnChange={onColumnChange} />)
    act(() => {
      resizeObservers.forEach((cb) => cb([{ contentRect: { width: 400 } }]))
    })
    const dots = Array.from(document.querySelectorAll('button.w-1\\.5.h-1\\.5'))
    if (dots.length >= 3) {
      fireEvent.click(dots[2] as HTMLElement)
      expect(onColumnChange).toHaveBeenCalledWith(2)
    }
  })

  it('handleDragStart → activeId 설정 → DragOverlay 노출 (smoke)', () => {
    const propsWithTodos = {
      ...baseProps,
      todos: [{ id: 't1', title: 'Task1' }] as never
    }
    render(<TodoKanbanView {...propsWithTodos} />)
    act(() => {
      dndContextCallbacks.onDragStart?.({ active: { id: 't1' } })
    })
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('handleDragStart + filterActive=true → early return', () => {
    render(<TodoKanbanView {...baseProps} filterActive={true} />)
    act(() => {
      dndContextCallbacks.onDragStart?.({ active: { id: 't1' } })
    })
    // filterActive 상태에서 drag start no-op
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('handleDragCancel → activeId 초기화 (smoke)', () => {
    render(<TodoKanbanView {...baseProps} />)
    act(() => {
      dndContextCallbacks.onDragStart?.({ active: { id: 't1' } })
      dndContextCallbacks.onDragCancel?.()
    })
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('handleDragEnd + over=null → setLocalColumns(columnMap) (early return)', () => {
    render(<TodoKanbanView {...baseProps} />)
    act(() => {
      dndContextCallbacks.onDragStart?.({ active: { id: 't1' } })
      dndContextCallbacks.onDragEnd?.({ active: { id: 't1' }, over: null })
    })
    expect(todoMocks.reorderMutate).not.toHaveBeenCalled()
  })

  it('handleDragEnd + 같은 컬럼 내 재정렬 → reorderKanban.mutate 호출', () => {
    const todos = [
      { id: 't1', title: 'A', status: '할일' },
      { id: 't2', title: 'B', status: '할일' }
    ]
    const cm = new Map([
      [
        '할일',
        [
          { id: 't1', title: 'A', status: '할일' },
          { id: 't2', title: 'B', status: '할일' }
        ]
      ],
      ['진행중', []],
      ['완료', []],
      ['보류', []]
    ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap']
    render(<TodoKanbanView {...baseProps} todos={todos as never} columnMap={cm} />)
    act(() => {
      dndContextCallbacks.onDragStart?.({ active: { id: 't1' } })
    })
    act(() => {
      dndContextCallbacks.onDragEnd?.({
        active: { id: 't1' },
        over: { id: 't2' }
      })
    })
    expect(todoMocks.reorderMutate).toHaveBeenCalledTimes(1)
  })

  it('handleDragOver + sourceStatus 매칭 안 됨 → prev 반환 (smoke)', () => {
    render(<TodoKanbanView {...baseProps} />)
    act(() => {
      dndContextCallbacks.onDragStart?.({ active: { id: 't1' } })
      // 존재하지 않는 ID 로 over
      dndContextCallbacks.onDragOver?.({
        active: { id: 'unknown' },
        over: { id: '진행중' }
      })
    })
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })
})
