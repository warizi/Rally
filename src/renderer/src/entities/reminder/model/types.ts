export interface ReminderItem {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: Date
  isFired: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SetReminderData {
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

export const REMINDER_OFFSETS = [
  { label: '10분 전', value: 10 * 60 * 1000 },
  { label: '30분 전', value: 30 * 60 * 1000 },
  { label: '1시간 전', value: 60 * 60 * 1000 },
  { label: '1일 전', value: 24 * 60 * 60 * 1000 },
  { label: '2일 전', value: 2 * 24 * 60 * 60 * 1000 }
] as const
