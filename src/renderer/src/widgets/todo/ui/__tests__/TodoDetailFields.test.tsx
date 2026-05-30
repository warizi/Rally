/**
 * widgets/todo/ui/TodoDetailFields.test.tsx
 *
 * 접기/펼치기 + localStorage 영속 + 필드 노출 + ReminderSelect 비활성 조건.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const detailMocks = vi.hoisted(() => ({
  updateMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: detailMocks.updateMutate })
}))
vi.mock('@features/todo/todo-field/ui/TodoCheckbox', () => ({
  TodoCheckbox: () => <div data-testid="todo-checkbox" />
}))
vi.mock('@features/todo/todo-field/ui/TodoStatusSelect', () => ({
  TodoStatusSelect: () => <div data-testid="status-select" />
}))
vi.mock('@features/todo/todo-field/ui/TodoPrioritySelect', () => ({
  TodoPrioritySelect: () => <div data-testid="priority-select" />
}))
const datePickerMocks = vi.hoisted(() => ({
  startDateOnChange: undefined as undefined | ((d: Date | null) => void),
  dueDateOnChange: undefined as undefined | ((d: Date | null) => void),
  startTimeOnChange: undefined as undefined | ((t: string | null) => void),
  dueTimeOnChange: undefined as undefined | ((t: string | null) => void)
}))

vi.mock('@shared/ui/date-picker-button', () => ({
  DatePickerButton: ({
    placeholder,
    onChange
  }: {
    placeholder?: string
    onChange?: (d: Date | null) => void
  }) => {
    // 시작일 placeholder 가 같아 첫 호출 = 시작일, 두번째 = 마감일
    if (!datePickerMocks.startDateOnChange) {
      datePickerMocks.startDateOnChange = onChange
    } else {
      datePickerMocks.dueDateOnChange = onChange
    }
    return <div data-testid="date-picker">{placeholder}</div>
  }
}))
vi.mock('@shared/ui/time-picker-button', () => ({
  TimePickerButton: ({
    disabled,
    onChange
  }: {
    disabled?: boolean
    onChange?: (t: string | null) => void
  }) => {
    if (!datePickerMocks.startTimeOnChange) {
      datePickerMocks.startTimeOnChange = onChange
    } else {
      datePickerMocks.dueTimeOnChange = onChange
    }
    return <div data-testid="time-picker" data-disabled={String(disabled)} />
  }
}))
vi.mock('@entities/reminder', () => ({
  ReminderSelect: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="reminder-select" data-disabled={String(disabled)} />
  )
}))

import { TodoDetailFields } from '../TodoDetailFields'
import type { TodoItem } from '@entities/todo'

function todo(over: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 't-1',
    title: 'My Todo',
    isDone: false,
    status: '할일',
    priority: 'medium',
    startDate: null,
    dueDate: null,
    doneAt: null,
    createdAt: new Date('2026-05-29'),
    ...over
  } as unknown as TodoItem
}

beforeEach(() => {
  localStorage.clear()
  detailMocks.updateMutate.mockClear()
  datePickerMocks.startDateOnChange = undefined
  datePickerMocks.dueDateOnChange = undefined
  datePickerMocks.startTimeOnChange = undefined
  datePickerMocks.dueTimeOnChange = undefined
})

describe('TodoDetailFields', () => {
  it('기본 → 펼침 (메타데이터 접기 버튼 노출 + 필드 보임)', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    expect(screen.getByText('메타데이터 접기')).toBeInTheDocument()
    expect(screen.getByTestId('todo-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('status-select')).toBeInTheDocument()
    expect(screen.getByTestId('priority-select')).toBeInTheDocument()
  })

  it('접기 버튼 클릭 → 펼치기 라벨 + 필드 숨김', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('메타데이터 접기'))
    expect(screen.getByText('메타데이터 펼치기')).toBeInTheDocument()
    expect(screen.queryByTestId('status-select')).not.toBeInTheDocument()
  })

  it('localStorage="1" 저장 시 마운트 시 접힘', () => {
    localStorage.setItem('rally:todo-detail-metadata-collapsed', '1')
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    expect(screen.getByText('메타데이터 펼치기')).toBeInTheDocument()
  })

  it('접기 토글 → localStorage 영속', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('메타데이터 접기'))
    expect(localStorage.getItem('rally:todo-detail-metadata-collapsed')).toBe('1')
  })

  it('startDate=null + dueDate=null → ReminderSelect disabled', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    expect(screen.getByTestId('reminder-select')).toHaveAttribute('data-disabled', 'true')
  })

  it('dueDate 있음 → ReminderSelect 활성', () => {
    render(<TodoDetailFields todo={todo({ dueDate: new Date() })} workspaceId="ws-1" />)
    expect(screen.getByTestId('reminder-select')).toHaveAttribute('data-disabled', 'false')
  })

  it('doneAt 있으면 "완료일" 라벨 노출', () => {
    render(<TodoDetailFields todo={todo({ doneAt: new Date('2026-05-30') })} workspaceId="ws-1" />)
    expect(screen.getByText('완료일')).toBeInTheDocument()
  })

  it('doneAt null → "완료일" 라벨 미노출', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    expect(screen.queryByText('완료일')).not.toBeInTheDocument()
  })

  it('startDate null → TimePickerButton disabled', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    const pickers = screen.getAllByTestId('time-picker')
    expect(pickers[0]).toHaveAttribute('data-disabled', 'true')
  })

  it('startDate 있음 → TimePickerButton 활성', () => {
    render(<TodoDetailFields todo={todo({ startDate: new Date() })} workspaceId="ws-1" />)
    const pickers = screen.getAllByTestId('time-picker')
    expect(pickers[0]).toHaveAttribute('data-disabled', 'false')
  })

  it('todo-checkbox + status-select + priority-select 모두 노출', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    expect(screen.getByTestId('todo-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('status-select')).toBeInTheDocument()
    expect(screen.getByTestId('priority-select')).toBeInTheDocument()
  })

  it('startDate + dueDate 양쪽 있음 → 두개의 TimePicker 모두 활성', () => {
    render(
      <TodoDetailFields
        todo={todo({ startDate: new Date(), dueDate: new Date() })}
        workspaceId="ws-1"
      />
    )
    const pickers = screen.getAllByTestId('time-picker')
    expect(pickers[0]).toHaveAttribute('data-disabled', 'false')
    expect(pickers[1]).toHaveAttribute('data-disabled', 'false')
  })

  it('startDate DatePicker onChange (날짜 변경) → updateTodo({startDate}) 호출', () => {
    render(
      <TodoDetailFields todo={todo({ startDate: new Date('2026-05-29') })} workspaceId="ws-1" />
    )
    const newDate = new Date('2026-06-01')
    datePickerMocks.startDateOnChange?.(newDate)
    expect(detailMocks.updateMutate).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      todoId: 't-1',
      data: { startDate: newDate }
    })
  })

  it('dueDate DatePicker onChange → updateTodo({dueDate})', () => {
    render(<TodoDetailFields todo={todo({ dueDate: new Date('2026-05-29') })} workspaceId="ws-1" />)
    const newDate = new Date('2026-06-15')
    datePickerMocks.dueDateOnChange?.(newDate)
    expect(detailMocks.updateMutate).toHaveBeenCalled()
  })

  it('startDate DatePicker onChange (null) → updateTodo({startDate:null})', () => {
    render(<TodoDetailFields todo={todo({ startDate: new Date() })} workspaceId="ws-1" />)
    datePickerMocks.startDateOnChange?.(null)
    expect(detailMocks.updateMutate).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      todoId: 't-1',
      data: { startDate: null }
    })
  })

  it('startTime TimePicker onChange → updateTodo({startDate: 적용된 시간})', () => {
    render(<TodoDetailFields todo={todo({ startDate: new Date() })} workspaceId="ws-1" />)
    datePickerMocks.startTimeOnChange?.('10:30')
    // mock applyTime 이 base 를 그대로 반환 → updateTodo 호출됨
    expect(detailMocks.updateMutate).toHaveBeenCalled()
  })

  it('dueTime TimePicker onChange (dueDate 없음) → updateTodo({dueDate: applyTime(null, time)})', () => {
    render(<TodoDetailFields todo={todo({ dueDate: null })} workspaceId="ws-1" />)
    datePickerMocks.dueTimeOnChange?.('15:00')
    expect(detailMocks.updateMutate).toHaveBeenCalled()
  })

  it('생성일 라벨 노출 (createdAt 한국 로케일)', () => {
    render(<TodoDetailFields todo={todo()} workspaceId="ws-1" />)
    expect(screen.getByText('생성일')).toBeInTheDocument()
  })
})
