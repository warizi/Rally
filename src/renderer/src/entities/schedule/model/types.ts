export type SchedulePriority = 'low' | 'medium' | 'high'

export interface ScheduleItem {
  id: string
  workspaceId: string | null
  title: string
  description: string | null
  location: string | null
  allDay: boolean
  startAt: Date
  endAt: Date
  color: string | null
  priority: SchedulePriority
  createdAt: Date
  updatedAt: Date
}

export interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: SchedulePriority
}

export interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: SchedulePriority
}

export interface ScheduleDateRange {
  start: Date
  end: Date
}
