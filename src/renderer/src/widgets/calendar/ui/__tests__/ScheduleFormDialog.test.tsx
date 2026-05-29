/**
 * widgets/calendar/ui/ScheduleFormDialog.test.tsx
 *
 * trigger 클릭 → dialog open. initialData 있음 → 수정 모드. controlled open.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  linkMutate: vi.fn(),
  setReminderMutate: vi.fn(),
  createPending: false,
  updatePending: false
}))

vi.mock('@entities/schedule', () => ({
  useCreateSchedule: () => ({ mutate: mocks.createMutate, isPending: mocks.createPending }),
  useUpdateSchedule: () => ({ mutate: mocks.updateMutate, isPending: mocks.updatePending })
}))

vi.mock('@entities/entity-link', () => ({
  useLinkEntity: () => ({ mutate: mocks.linkMutate })
}))

vi.mock('@entities/reminder', () => ({
  ReminderPendingSelect: () => <div data-testid="reminder-pending" />,
  ReminderSelect: () => <div data-testid="reminder-select" />,
  useSetReminder: () => ({ mutate: mocks.setReminderMutate })
}))

vi.mock('@/widgets/entity-link', () => ({
  PendingLinkPicker: () => <div data-testid="pending-link-picker" />
}))

vi.mock('../ColorPicker', () => ({
  ColorPicker: () => <div data-testid="color-picker" />
}))

beforeEach(() => {
  mocks.createMutate.mockReset()
  mocks.updateMutate.mockReset()
  mocks.linkMutate.mockReset()
  mocks.setReminderMutate.mockReset()
})

import { ScheduleFormDialog } from '../ScheduleFormDialog'

describe('ScheduleFormDialog', () => {
  it('trigger 클릭 → dialog open + 새 일정 타이틀', () => {
    render(
      <ScheduleFormDialog workspaceId="ws" trigger={<button data-testid="trigger">+</button>} />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText(/일정/)).toBeInTheDocument()
  })

  it('controlled open=true → 즉시 dialog 노출', () => {
    render(<ScheduleFormDialog workspaceId="ws" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByPlaceholderText(/제목/)).toBeInTheDocument()
  })

  it('initialData (수정 모드) → 기존 title 표시', () => {
    render(
      <ScheduleFormDialog
        workspaceId="ws"
        open={true}
        onOpenChange={vi.fn()}
        initialData={
          {
            id: 's1',
            title: '기존 일정',
            description: '',
            location: '',
            allDay: false,
            startAt: new Date('2026-05-29T10:00:00Z'),
            endAt: new Date('2026-05-29T11:00:00Z'),
            color: null,
            priority: 'medium'
          } as unknown as Parameters<typeof ScheduleFormDialog>[0]['initialData']
        }
      />
    )
    expect(screen.getByDisplayValue('기존 일정')).toBeInTheDocument()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<ScheduleFormDialog workspaceId="ws" open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
