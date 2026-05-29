/**
 * features/todo/manage-recurring/ui/RecurringRuleFormDialog.test.tsx
 *
 * mode=create → createRule.mutate.
 * mode=edit → updateRule.mutate + form 초기 reset to rule values.
 * 성공 → toast.success + onOpenChange(false).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  createPending: false,
  updatePending: false,
  toastSuccess: vi.fn(),
  receivedFormControl: null as unknown as { _formState?: unknown }
}))

vi.mock('@entities/recurring-rule', () => ({
  useCreateRecurringRule: () => ({ mutate: mocks.createMutate, isPending: mocks.createPending }),
  useUpdateRecurringRule: () => ({ mutate: mocks.updateMutate, isPending: mocks.updatePending })
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess }
}))

vi.mock('../../model/recurring-rule-form', () => ({
  recurringRuleSchema: { _def: {}, parse: (v: unknown) => v, safeParse: () => ({ success: true }) },
  DEFAULT_FORM_VALUES: {
    title: 'Default Title',
    description: '',
    priority: 'medium',
    recurrenceType: 'daily',
    daysOfWeek: [],
    startDate: '2026-01-01',
    endDate: null,
    startTime: null,
    endTime: null,
    reminderOffsetMs: null
  }
}))

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => undefined
}))

vi.mock('../RecurringRuleFormFields', () => ({
  RecurringRuleFormFields: ({ control }: { control: unknown }) => {
    mocks.receivedFormControl = control as { _formState?: unknown }
    return <div data-testid="form-fields" />
  }
}))

import { RecurringRuleFormDialog } from '../RecurringRuleFormDialog'

beforeEach(() => {
  mocks.createMutate.mockReset()
  mocks.updateMutate.mockReset()
  mocks.createPending = false
  mocks.updatePending = false
  mocks.toastSuccess.mockReset()
})

describe('RecurringRuleFormDialog', () => {
  it('mode=create → 타이틀 "반복 할일 추가" + "추가" 버튼', () => {
    render(
      <RecurringRuleFormDialog mode="create" workspaceId="ws" open={true} onOpenChange={vi.fn()} />
    )
    expect(screen.getByText('반복 할일 추가')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
    expect(screen.getByTestId('form-fields')).toBeInTheDocument()
  })

  it('mode=edit → 타이틀 "반복 할일 수정" + "저장" 버튼', () => {
    const rule = {
      id: 'r1',
      title: '원본',
      description: '',
      priority: 'medium',
      recurrenceType: 'daily',
      daysOfWeek: null,
      startDate: '2026-01-01',
      endDate: null,
      startTime: null,
      endTime: null,
      reminderOffsetMs: null
    } as unknown as Parameters<typeof RecurringRuleFormDialog>[0]['rule' & keyof object] & {
      id: string
    }
    render(
      <RecurringRuleFormDialog
        mode="edit"
        workspaceId="ws"
        rule={
          rule as unknown as Parameters<typeof RecurringRuleFormDialog>[0] extends {
            mode: 'edit'
            rule: infer R
          }
            ? R
            : never
        }
        open={true}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.getByText('반복 할일 수정')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
  })

  it('createPending=true → "추가" 버튼 disabled', () => {
    mocks.createPending = true
    render(
      <RecurringRuleFormDialog mode="create" workspaceId="ws" open={true} onOpenChange={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })

  it('updatePending=true → "저장" 버튼 disabled', () => {
    mocks.updatePending = true
    const rule = {
      id: 'r1',
      title: 'X',
      description: '',
      priority: 'medium',
      recurrenceType: 'daily',
      daysOfWeek: null,
      startDate: '2026-01-01',
      endDate: null,
      startTime: null,
      endTime: null,
      reminderOffsetMs: null
    } as unknown as Parameters<typeof RecurringRuleFormDialog>[0] extends {
      mode: 'edit'
      rule: infer R
    }
      ? R
      : never
    render(
      <RecurringRuleFormDialog
        mode="edit"
        workspaceId="ws"
        rule={rule}
        open={true}
        onOpenChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('취소 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(
      <RecurringRuleFormDialog
        mode="create"
        workspaceId="ws"
        open={true}
        onOpenChange={onOpenChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('mode=create + 제출 성공 → createRule.mutate + toast + onOpenChange(false)', async () => {
    const onOpenChange = vi.fn()
    mocks.createMutate.mockImplementation((_arg, opts) => opts?.onSuccess?.())
    render(
      <RecurringRuleFormDialog
        mode="create"
        workspaceId="ws"
        open={true}
        onOpenChange={onOpenChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() =>
      expect(mocks.createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws' }),
        expect.any(Object)
      )
    )
    expect(mocks.toastSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
