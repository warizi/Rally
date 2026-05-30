/**
 * widgets/todo/ui/CreateTodoDialog.test.tsx
 *
 * trigger 클릭 → dialog open. parentId 있으면 "하위 할 일 추가" + titleOnly.
 * 제출 → createTodo.mutate. 취소 → onOpenChange(false).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  linkMutate: vi.fn(),
  setReminderMutate: vi.fn(),
  defaultDateEnabled: false,
  isPending: false,
  formFieldsTitleOnly: false
}))

vi.mock('@entities/todo', () => ({
  useCreateTodo: () => ({ mutate: mocks.createMutate, isPending: mocks.isPending })
}))

vi.mock('@entities/entity-link', () => ({
  useLinkEntity: () => ({ mutate: mocks.linkMutate })
}))

vi.mock('@/widgets/entity-link', () => ({
  PendingLinkPicker: () => <div data-testid="pending-link-picker" />
}))

vi.mock('@entities/reminder', () => ({
  ReminderPendingSelect: () => <div data-testid="reminder-pending" />,
  useSetReminder: () => ({ mutate: mocks.setReminderMutate })
}))

vi.mock('../TodoFormFields', () => ({
  TodoFormFields: ({
    titleOnly,
    form
  }: {
    titleOnly?: boolean
    form?: { setValue: (k: string, v: string) => void }
  }) => {
    mocks.formFieldsTitleOnly = !!titleOnly
    // 테스트에서 form 에 title 을 미리 채우기 위한 helper button.
    return (
      <div data-testid="todo-form-fields">
        {titleOnly ? 'title-only' : 'full'}
        {form && (
          <button
            type="button"
            data-testid="form-set-title"
            onClick={() => form.setValue('title', 'Test Todo')}
          >
            set-title
          </button>
        )}
      </div>
    )
  }
}))

vi.mock('../../model/use-todo-default-date-setting', () => ({
  useTodoDefaultDateSetting: () => ({ enabled: mocks.defaultDateEnabled })
}))

vi.mock('@shared/lib/datetime', () => ({
  formatTime: () => '',
  applyTime: (d: Date | null) => d
}))

vi.mock('@shared/ui/date-picker-button', () => ({
  DatePickerButton: ({ placeholder }: { placeholder: string }) => (
    <button data-testid={`date-${placeholder}`}>{placeholder}</button>
  )
}))

vi.mock('@shared/ui/time-picker-button', () => ({
  TimePickerButton: ({ placeholder }: { placeholder: string }) => (
    <button data-testid={`time-${placeholder}`}>{placeholder}</button>
  )
}))

import { CreateTodoDialog } from '../CreateTodoDialog'

beforeEach(() => {
  mocks.createMutate.mockReset()
  mocks.linkMutate.mockReset()
  mocks.setReminderMutate.mockReset()
  mocks.defaultDateEnabled = false
  mocks.isPending = false
  mocks.formFieldsTitleOnly = false
})

describe('CreateTodoDialog', () => {
  it('trigger 클릭 → dialog open + "할 일 추가" 타이틀', () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('할 일 추가')).toBeInTheDocument()
    expect(screen.getByTestId('todo-form-fields')).toHaveTextContent('full')
  })

  it('parentId 있음 → "하위 할 일 추가" + titleOnly=true', () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        parentId="p1"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('하위 할 일 추가')).toBeInTheDocument()
    expect(mocks.formFieldsTitleOnly).toBe(true)
  })

  it('titleOnly=true → 시작일/마감일/알림/링크 picker 미노출', () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        parentId="p1"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.queryByTestId('pending-link-picker')).not.toBeInTheDocument()
  })

  it('titleOnly=false → PendingLinkPicker 노출', () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByTestId('pending-link-picker')).toBeInTheDocument()
  })

  it('취소 클릭 → dialog 닫힘', () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('할 일 추가')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByText('할 일 추가')).not.toBeInTheDocument()
  })

  it('isPending=true → "추가" 버튼 disabled', () => {
    mocks.isPending = true
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })

  it('defaultDateEnabled=true → ReminderPendingSelect 노출 (startDate 기본 설정)', () => {
    mocks.defaultDateEnabled = true
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByTestId('reminder-pending')).toBeInTheDocument()
  })

  it('defaultStatus="진행중" → form 초기 status 반영 (smoke)', () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        defaultStatus="진행중"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('할 일 추가')).toBeInTheDocument()
  })

  it('취소 후 재오픈 → form 다시 noop reset (smoke)', () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('할 일 추가')).toBeInTheDocument()
  })

  it('titleOnly=true → DatePickerButton 모두 미노출', () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        parentId="p1"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    // DatePickerButton 들이 노출되지 않음.
    expect(screen.queryByTestId(/^date-/)).toBeNull()
  })

  it('defaultDateEnabled=false → 기본 dueDate/startDate null 유지 (smoke)', () => {
    mocks.defaultDateEnabled = false
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    // defaultDateEnabled=false → 기본 startDate/dueDate 둘 다 null → ReminderPendingSelect 노출 안 됨 (조건 (startDate || dueDate))
    expect(screen.queryByTestId('reminder-pending')).toBeNull()
  })

  it('titleOnly=false (parentId 없음) → 시작일/마감일 라벨 노출', () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('시작일')).toBeInTheDocument()
    expect(screen.getByText('마감일')).toBeInTheDocument()
  })

  it('titleOnly=true (parentId 있음) → 시작일/마감일 라벨 미노출', () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        parentId="p1"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.queryByText('시작일')).toBeNull()
    expect(screen.queryByText('마감일')).toBeNull()
  })

  it('defaultDateEnabled=true → DatePickerButton + TimePickerButton 노출', () => {
    mocks.defaultDateEnabled = true
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    // DatePicker 와 TimePicker 가 시작일/마감일 둘 다 (총 2개씩)
    expect(screen.getAllByTestId(/^date-/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByTestId(/^time-/).length).toBeGreaterThanOrEqual(2)
  })
})
