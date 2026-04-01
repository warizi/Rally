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
