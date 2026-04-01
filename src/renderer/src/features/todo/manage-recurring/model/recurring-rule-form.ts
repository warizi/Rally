import { z } from 'zod'

export const recurringRuleSchema = z
  .object({
    title: z.string().min(1, '제목을 입력하세요').max(200),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    recurrenceType: z.enum(['daily', 'weekday', 'weekend', 'custom']),
    daysOfWeek: z.array(z.number().min(0).max(6)),
    startDate: z.date({ message: '시작일을 입력하세요' }),
    endDate: z.date().nullable(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, '시간 형식이 올바르지 않습니다')
      .nullable(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, '시간 형식이 올바르지 않습니다')
      .nullable(),
    reminderOffsetMs: z.number().nullable()
  })
  .refine(
    (val) => {
      if (val.recurrenceType === 'custom') return val.daysOfWeek.length > 0
      return true
    },
    { message: '반복 요일을 하나 이상 선택하세요', path: ['daysOfWeek'] }
  )
  .refine(
    (val) => {
      if (val.endDate && val.startDate) return val.endDate >= val.startDate
      return true
    },
    { message: '종료일은 시작일 이후여야 합니다', path: ['endDate'] }
  )

export type RecurringRuleFormValues = z.infer<typeof recurringRuleSchema>

function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const DEFAULT_FORM_VALUES: RecurringRuleFormValues = {
  title: '',
  description: '',
  priority: 'medium',
  recurrenceType: 'daily',
  daysOfWeek: [],
  startDate: todayMidnight(),
  endDate: null,
  startTime: null,
  endTime: null,
  reminderOffsetMs: null
}

export const RECURRENCE_TYPE_LABELS: Record<string, string> = {
  daily: '매일',
  weekday: '주중 (월~금)',
  weekend: '주말 (토~일)',
  custom: '직접 선택'
}

export const DAY_LABELS: Record<number, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토'
}

export const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: '없음', value: null },
  { label: '10분 전', value: 10 * 60 * 1000 },
  { label: '30분 전', value: 30 * 60 * 1000 },
  { label: '1시간 전', value: 60 * 60 * 1000 },
  { label: '1일 전', value: 24 * 60 * 60 * 1000 }
]
