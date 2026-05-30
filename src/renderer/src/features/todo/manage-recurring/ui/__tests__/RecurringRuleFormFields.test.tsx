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

  it('recurrenceType=custom → 요일 선택 버튼 (월/화/...) 노출', () => {
    render(<Harness recurrenceType="custom" />)
    expect(screen.getByText('월')).toBeInTheDocument()
    expect(screen.getByText('금')).toBeInTheDocument()
  })

  it('recurrenceType=daily → 요일 선택 미노출', () => {
    render(<Harness recurrenceType="daily" />)
    // 일/월/화/수/목/금/토 같은 단일 글자 day labels 가 없어야 함 — daily 에서.
    // (DAY_LABELS 항목은 custom 일 때만 렌더링됨)
    const dayButtons = screen.queryAllByRole('button', { name: /^[일월화수목금토]$/ })
    expect(dayButtons.length).toBe(0)
  })

  it('placeholder 노출 (설명 textarea)', () => {
    render(<Harness />)
    expect(screen.getByPlaceholderText(/설명/)).toBeInTheDocument()
  })

  it('알림 라벨 노출', () => {
    render(<Harness />)
    expect(screen.getByText('알림')).toBeInTheDocument()
  })
})
