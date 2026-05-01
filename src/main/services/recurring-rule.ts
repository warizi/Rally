import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { recurringRuleRepository } from '../repositories/recurring-rule'
import { trashService } from './trash'
import type { RecurringRule } from '../repositories/recurring-rule'

export type RecurrenceType = 'daily' | 'weekday' | 'weekend' | 'custom'

export interface RecurringRuleItem {
  id: string
  workspaceId: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  recurrenceType: RecurrenceType
  daysOfWeek: number[] | null
  startDate: Date
  endDate: Date | null
  startTime: string | null
  endTime: string | null
  reminderOffsetMs: number | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateRecurringRuleData {
  title: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  recurrenceType: RecurrenceType
  daysOfWeek?: number[]
  startDate: Date
  endDate?: Date | null
  startTime?: string | null
  endTime?: string | null
  reminderOffsetMs?: number | null
}

export interface UpdateRecurringRuleData {
  title?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  recurrenceType?: RecurrenceType
  daysOfWeek?: number[] | null
  startDate?: Date
  endDate?: Date | null
  startTime?: string | null
  endTime?: string | null
  reminderOffsetMs?: number | null
}

function toMidnight(d: Date): Date {
  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  return result
}

function toDate(v: Date | number | null | undefined): Date | null {
  if (v == null) return null
  return v instanceof Date ? v : new Date(v)
}

function parseDaysOfWeek(raw: string | null): number[] | null {
  if (!raw) return null
  return raw
    .split(',')
    .map(Number)
    .filter((n) => !isNaN(n))
}

function serializeDaysOfWeek(days: number[] | null | undefined): string | null {
  if (!days || days.length === 0) return null
  return days.join(',')
}

function toItem(rule: RecurringRule): RecurringRuleItem {
  return {
    id: rule.id,
    workspaceId: rule.workspaceId,
    title: rule.title,
    description: rule.description,
    priority: rule.priority as RecurringRuleItem['priority'],
    recurrenceType: rule.recurrenceType as RecurrenceType,
    daysOfWeek: parseDaysOfWeek(rule.daysOfWeek),
    startDate: toDate(rule.startDate)!,
    endDate: toDate(rule.endDate),
    startTime: rule.startTime ?? null,
    endTime: rule.endTime ?? null,
    reminderOffsetMs: rule.reminderOffsetMs ?? null,
    createdAt: toDate(rule.createdAt)!,
    updatedAt: toDate(rule.updatedAt)!
  }
}

function isRuleOnDate(rule: RecurringRuleItem, date: Date): boolean {
  const dayOfWeek = date.getDay()
  switch (rule.recurrenceType) {
    case 'daily':
      return true
    case 'weekday':
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case 'weekend':
      return dayOfWeek === 0 || dayOfWeek === 6
    case 'custom':
      return (rule.daysOfWeek ?? []).includes(dayOfWeek)
    default:
      return false
  }
}

export const recurringRuleService = {
  findByWorkspace(workspaceId: string): RecurringRuleItem[] {
    return recurringRuleRepository.findByWorkspaceId(workspaceId).map(toItem)
  },

  findTodayRules(workspaceId: string, date: Date): RecurringRuleItem[] {
    // 날짜 범위 후보 (startDate ~ endDate) 조회
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    const candidates = recurringRuleRepository
      .findCandidatesOnDate(workspaceId, startOfDay, endOfDay)
      .map(toItem)
    // 요일 필터
    return candidates.filter((rule) => isRuleOnDate(rule, date))
  },

  create(workspaceId: string, data: CreateRecurringRuleData): RecurringRuleItem {
    if (!data.title.trim()) {
      throw new ValidationError('제목을 입력하세요')
    }
    if (data.recurrenceType === 'custom' && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
      throw new ValidationError('직접 선택 반복은 최소 하나의 요일이 필요합니다')
    }
    if (data.endDate && data.endDate < data.startDate) {
      throw new ValidationError('종료일은 시작일 이후여야 합니다')
    }
    const now = new Date()
    const row = recurringRuleRepository.create({
      id: nanoid(),
      workspaceId,
      title: data.title.trim(),
      description: data.description ?? '',
      priority: data.priority ?? 'medium',
      recurrenceType: data.recurrenceType,
      daysOfWeek: serializeDaysOfWeek(data.daysOfWeek),
      startDate: toMidnight(data.startDate),
      endDate: data.endDate ? toMidnight(data.endDate) : null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      reminderOffsetMs: data.reminderOffsetMs ?? null,
      createdAt: now,
      updatedAt: now
    })
    return toItem(row)
  },

  update(ruleId: string, data: UpdateRecurringRuleData): RecurringRuleItem {
    const existing = recurringRuleRepository.findById(ruleId)
    if (!existing) throw new NotFoundError('반복 규칙을 찾을 수 없습니다')
    if (data.recurrenceType === 'custom' && data.daysOfWeek !== undefined) {
      if (!data.daysOfWeek || data.daysOfWeek.length === 0) {
        throw new ValidationError('직접 선택 반복은 최소 하나의 요일이 필요합니다')
      }
    }
    const updated = recurringRuleRepository.update(ruleId, {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.recurrenceType !== undefined && { recurrenceType: data.recurrenceType }),
      ...(data.daysOfWeek !== undefined && { daysOfWeek: serializeDaysOfWeek(data.daysOfWeek) }),
      ...(data.startDate !== undefined && { startDate: toMidnight(data.startDate) }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? toMidnight(data.endDate) : null
      }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.reminderOffsetMs !== undefined && { reminderOffsetMs: data.reminderOffsetMs }),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError('반복 규칙을 찾을 수 없습니다')
    return toItem(updated)
  },

  delete(ruleId: string, options: { permanent?: boolean } = {}): void {
    const existing = recurringRuleRepository.findById(ruleId)
    if (!existing) throw new NotFoundError('반복 규칙을 찾을 수 없습니다')

    if (!options.permanent) {
      // 휴지통 이동 — soft delete는 row를 안 지우니 completions의 ruleId set null이 안 트리거됨 (의도)
      trashService.softRemove(existing.workspaceId, 'recurring_rule', ruleId)
      return
    }

    // onDelete: set null → completions는 ruleId=null로 보존
    recurringRuleRepository.delete(ruleId)
  }
}
