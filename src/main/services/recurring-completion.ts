import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { recurringCompletionRepository } from '../repositories/recurring-completion'
import { recurringRuleRepository } from '../repositories/recurring-rule'
import type { RecurringCompletion } from '../repositories/recurring-completion'

export interface RecurringCompletionItem {
  id: string
  ruleId: string | null
  ruleTitle: string
  workspaceId: string
  completedDate: string
  completedAt: Date
  createdAt: Date
}

function toDate(v: Date | number): Date {
  return v instanceof Date ? v : new Date(v)
}

function toItem(row: RecurringCompletion): RecurringCompletionItem {
  return {
    id: row.id,
    ruleId: row.ruleId ?? null,
    ruleTitle: row.ruleTitle,
    workspaceId: row.workspaceId,
    completedDate: row.completedDate,
    completedAt: toDate(row.completedAt),
    createdAt: toDate(row.createdAt)
  }
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const recurringCompletionService = {
  complete(ruleId: string, date: Date): RecurringCompletionItem {
    const rule = recurringRuleRepository.findById(ruleId)
    if (!rule) throw new NotFoundError('반복 규칙을 찾을 수 없습니다')

    const completedDate = toDateString(date)

    // 멱등성: 이미 완료된 경우 기존 레코드 반환
    const existing = recurringCompletionRepository.findByRuleAndDate(ruleId, completedDate)
    if (existing) return toItem(existing)

    const now = new Date()
    const row = recurringCompletionRepository.create({
      id: nanoid(),
      ruleId,
      ruleTitle: rule.title,
      workspaceId: rule.workspaceId,
      completedDate,
      completedAt: now,
      createdAt: now
    })
    return toItem(row)
  },

  uncomplete(completionId: string): void {
    const existing = recurringCompletionRepository.findById(completionId)
    if (!existing) throw new NotFoundError('반복 완료 이력을 찾을 수 없습니다')
    recurringCompletionRepository.delete(completionId)
  },

  findByWorkspace(workspaceId: string): RecurringCompletionItem[] {
    return recurringCompletionRepository.findAllByWorkspace(workspaceId).map(toItem)
  },

  findTodayByWorkspace(workspaceId: string, date: Date): RecurringCompletionItem[] {
    const completedDate = toDateString(date)
    return recurringCompletionRepository
      .findByWorkspaceAndDate(workspaceId, completedDate)
      .map(toItem)
  }
}
