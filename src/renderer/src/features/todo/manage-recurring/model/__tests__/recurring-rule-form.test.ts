/**
 * features/todo/manage-recurring/model/recurring-rule-form.test.ts
 *
 * zod schema — 제목 길이 / 시간 형식 / custom 요일 / endDate ≥ startDate refine.
 * DEFAULT_FORM_VALUES / LABEL 상수 검증.
 */
import { describe, it, expect } from 'vitest'
import {
  recurringRuleSchema,
  DEFAULT_FORM_VALUES,
  RECURRENCE_TYPE_LABELS,
  DAY_LABELS,
  REMINDER_OPTIONS
} from '../recurring-rule-form'

function baseValues(): Record<string, unknown> {
  // DEFAULT_FORM_VALUES.title 은 '' 이므로 schema 검증 시 fail. 유효 시나리오 빌드용 helper.
  return { ...DEFAULT_FORM_VALUES, title: 'My recurring' }
}

describe('recurringRuleSchema', () => {
  it('기본값으로 통과 (daily)', () => {
    expect(recurringRuleSchema.safeParse(baseValues()).success).toBe(true)
  })

  it('빈 title → 실패 (DEFAULT_FORM_VALUES 의 기본 title)', () => {
    const r = recurringRuleSchema.safeParse({ ...DEFAULT_FORM_VALUES, title: '' })
    expect(r.success).toBe(false)
  })

  it('200자 초과 title → 실패', () => {
    const r = recurringRuleSchema.safeParse({ ...baseValues(), title: 'a'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('알 수 없는 priority → 실패', () => {
    const r = recurringRuleSchema.safeParse({ ...baseValues(), priority: 'urgent' })
    expect(r.success).toBe(false)
  })

  it('잘못된 startTime 형식 (HH:MM 아님) → 실패', () => {
    const r = recurringRuleSchema.safeParse({ ...baseValues(), startTime: '9:5' })
    expect(r.success).toBe(false)
  })

  it('null startTime/endTime → 통과', () => {
    expect(
      recurringRuleSchema.safeParse({ ...baseValues(), startTime: null, endTime: null }).success
    ).toBe(true)
  })

  it('custom + daysOfWeek 비어있음 → 실패 (refine)', () => {
    const r = recurringRuleSchema.safeParse({
      ...baseValues(),
      recurrenceType: 'custom',
      daysOfWeek: []
    })
    expect(r.success).toBe(false)
  })

  it('custom + daysOfWeek 1개 이상 → 통과', () => {
    expect(
      recurringRuleSchema.safeParse({
        ...baseValues(),
        recurrenceType: 'custom',
        daysOfWeek: [1, 3, 5]
      }).success
    ).toBe(true)
  })

  it('daysOfWeek 범위 외 (7) → 실패', () => {
    const r = recurringRuleSchema.safeParse({
      ...baseValues(),
      recurrenceType: 'custom',
      daysOfWeek: [7]
    })
    expect(r.success).toBe(false)
  })

  it('endDate < startDate → 실패 (refine)', () => {
    const r = recurringRuleSchema.safeParse({
      ...baseValues(),
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-01')
    })
    expect(r.success).toBe(false)
  })

  it('endDate >= startDate → 통과', () => {
    expect(
      recurringRuleSchema.safeParse({
        ...baseValues(),
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-10')
      }).success
    ).toBe(true)
  })

  it('endDate null → 통과 (영구 반복)', () => {
    expect(
      recurringRuleSchema.safeParse({
        ...baseValues(),
        startDate: new Date('2026-06-01'),
        endDate: null
      }).success
    ).toBe(true)
  })
})

describe('DEFAULT_FORM_VALUES', () => {
  it('startDate 는 자정 (00:00:00.000)', () => {
    const d = DEFAULT_FORM_VALUES.startDate
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('기본 recurrenceType=daily, priority=medium', () => {
    expect(DEFAULT_FORM_VALUES.recurrenceType).toBe('daily')
    expect(DEFAULT_FORM_VALUES.priority).toBe('medium')
    expect(DEFAULT_FORM_VALUES.daysOfWeek).toEqual([])
  })
})

describe('LABEL/OPTION 상수', () => {
  it('RECURRENCE_TYPE_LABELS 모든 4종 정의', () => {
    expect(Object.keys(RECURRENCE_TYPE_LABELS).sort()).toEqual([
      'custom',
      'daily',
      'weekday',
      'weekend'
    ])
  })

  it('DAY_LABELS 7개 + 한글 요일', () => {
    expect(Object.keys(DAY_LABELS)).toHaveLength(7)
    expect(DAY_LABELS[0]).toBe('일')
    expect(DAY_LABELS[6]).toBe('토')
  })

  it('REMINDER_OPTIONS 첫 값은 null (없음)', () => {
    expect(REMINDER_OPTIONS[0].value).toBe(null)
    expect(REMINDER_OPTIONS[0].label).toBe('없음')
  })

  it('REMINDER_OPTIONS 분/시간/일 단위 ms 계산 일치', () => {
    expect(REMINDER_OPTIONS.find((o) => o.label === '10분 전')?.value).toBe(10 * 60 * 1000)
    expect(REMINDER_OPTIONS.find((o) => o.label === '1시간 전')?.value).toBe(60 * 60 * 1000)
    expect(REMINDER_OPTIONS.find((o) => o.label === '1일 전')?.value).toBe(24 * 60 * 60 * 1000)
  })
})
