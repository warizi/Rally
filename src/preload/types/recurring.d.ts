import type { IpcResponse } from './common'

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
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
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

export interface RecurringRuleAPI {
  findByWorkspace: (workspaceId: string) => Promise<IpcResponse<RecurringRuleItem[]>>
  findToday: (workspaceId: string, date: Date) => Promise<IpcResponse<RecurringRuleItem[]>>
  create: (
    workspaceId: string,
    data: CreateRecurringRuleData
  ) => Promise<IpcResponse<RecurringRuleItem>>
  update: (ruleId: string, data: UpdateRecurringRuleData) => Promise<IpcResponse<RecurringRuleItem>>
  delete: (ruleId: string) => Promise<IpcResponse<void>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}

export interface RecurringCompletionItem {
  id: string
  ruleId: string | null
  ruleTitle: string
  workspaceId: string
  completedDate: string
  completedAt: Date
  createdAt: Date
}

export interface RecurringCompletionAPI {
  complete: (ruleId: string, date: Date) => Promise<IpcResponse<RecurringCompletionItem>>
  uncomplete: (completionId: string) => Promise<IpcResponse<void>>
  findTodayByWorkspace: (
    workspaceId: string,
    date: Date
  ) => Promise<IpcResponse<RecurringCompletionItem[]>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}
