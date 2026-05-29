/**
 * features/todo/manage-recurring/ui/RecurringRuleFormFields.test.tsx
 *
 * 필수 form fields (title/description/priority/recurrenceType + custom일 때 daysOfWeek) 렌더.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { Form } from '@shared/ui/form'
import { RecurringRuleFormFields } from '../RecurringRuleFormFields'

function Harness({
  recurrenceType = 'daily'
}: {
  recurrenceType?: 'daily' | 'weekday' | 'weekend' | 'custom'
}): React.JSX.Element {
  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      recurrenceType,
      daysOfWeek: [],
      startDate: '2026-01-01',
      endDate: null,
      startTime: null,
      endTime: null,
      reminderOffsetMs: null
    }
  })
  return (
    <FormProvider {...form}>
      <Form {...form}>
        <RecurringRuleFormFields control={form.control} />
      </Form>
    </FormProvider>
  )
}

describe('RecurringRuleFormFields', () => {
  it('필수 라벨 (제목/설명/중요도/반복) 노출', () => {
    render(<Harness />)
    expect(screen.getByText('제목')).toBeInTheDocument()
    expect(screen.getByText('설명')).toBeInTheDocument()
    expect(screen.getByText('중요도')).toBeInTheDocument()
    expect(screen.getByText('반복')).toBeInTheDocument()
  })

  it('placeholder 노출 (제목 input)', () => {
    render(<Harness />)
    expect(screen.getByPlaceholderText(/반복 할일 제목/)).toBeInTheDocument()
  })

  it('시작일/종료일 DatePickerButton 노출', () => {
    render(<Harness />)
    expect(screen.getByText('시작일')).toBeInTheDocument()
    expect(screen.getByText('종료일')).toBeInTheDocument()
  })
})
