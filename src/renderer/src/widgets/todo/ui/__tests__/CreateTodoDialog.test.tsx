/**
 * widgets/todo/ui/CreateTodoDialog.test.tsx
 *
 * trigger 클릭 → dialog open. parentId 있으면 "하위 할 일 추가" + titleOnly.
 * 제출 → createTodo.mutate. 취소 → onOpenChange(false).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  linkMutate: vi.fn(),
  setReminderMutate: vi.fn(),
  defaultDateEnabled: false,
  isPending: false
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

vi.mock('../TodoFormFields', async () => {
  const rhf = await vi.importActual<typeof import('react-hook-form')>('react-hook-form')
  function FormFieldsMock({ titleOnly }: { titleOnly?: boolean }): React.JSX.Element {
    const ctx = rhf.useFormContext()
    return (
      <div data-testid="todo-form-fields" data-title-only={String(!!titleOnly)}>
        {titleOnly ? 'title-only' : 'full'}
        {ctx && (
          <button
            type="button"
            data-testid="form-set-title"
            onClick={() => ctx.setValue('title', 'Test Todo')}
          >
            set-title
          </button>
        )}
      </div>
    )
  }
  return { TodoFormFields: FormFieldsMock }
})

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
    expect(screen.getByTestId('todo-form-fields')).toHaveAttribute('data-title-only', 'true')
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

  it('제출 (날짜 없음) → createTodo.mutate 호출 + dueDate=null', async () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByTestId('form-set-title'))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    const arg = mocks.createMutate.mock.calls[0][0]
    expect(arg.data.title).toBe('Test Todo')
    expect(arg.data.dueDate).toBeNull()
    expect(arg.data.startDate).toBeNull()
    expect(arg.data.parentId).toBeNull()
  })

  it('제출 + parentId 있음 → data.parentId 전달', async () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        parentId="parent-1"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByTestId('form-set-title'))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    expect(mocks.createMutate.mock.calls[0][0].data.parentId).toBe('parent-1')
  })

  it('제출 (defaultDateEnabled) → 같은 날 → 시간 09:00/10:00 자동 설정', async () => {
    mocks.defaultDateEnabled = true
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByTestId('form-set-title'))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    const arg = mocks.createMutate.mock.calls[0][0]
    // startDate 09:00, dueDate 10:00
    expect((arg.data.startDate as Date).getHours()).toBe(9)
    expect((arg.data.dueDate as Date).getHours()).toBe(10)
  })

  it('제출 onSuccess → pendingLinks 있으면 linkEntity.mutate 호출 안 됨 (pending=빈)', async () => {
    mocks.createMutate.mockImplementation(
      (_v: unknown, opts: { onSuccess: (data: { id: string }) => void }) => {
        opts.onSuccess({ id: 'new-todo-1' })
      }
    )
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByTestId('form-set-title'))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    expect(mocks.linkMutate).not.toHaveBeenCalled()
    expect(mocks.setReminderMutate).not.toHaveBeenCalled()
    expect(screen.queryByText('할 일 추가')).not.toBeInTheDocument()
  })

  it('defaultStatus 미지정 → 기본 "할일"', async () => {
    render(<CreateTodoDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />)
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByTestId('form-set-title'))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    expect(mocks.createMutate.mock.calls[0][0].data.status).toBe('할일')
  })

  it('defaultStatus="진행중" + 제출 → data.status="진행중"', async () => {
    render(
      <CreateTodoDialog
        workspaceId="ws"
        defaultStatus="진행중"
        trigger={<button data-testid="trigger">+</button>}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByTestId('form-set-title'))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(mocks.createMutate).toHaveBeenCalledTimes(1))
    expect(mocks.createMutate.mock.calls[0][0].data.status).toBe('진행중')
  })
})
