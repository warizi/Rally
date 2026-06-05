import type { IpcResponse } from './common'
import type { TodoItem } from './todo'

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
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
  updatedAt: Date
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
}

export interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface ScheduleDateRange {
  start: Date
  end: Date
}

export interface ScheduleAPI {
  findAllByWorkspace: (workspaceId: string) => Promise<IpcResponse<ScheduleItem[]>>
  findByWorkspace: (
    workspaceId: string,
    range: ScheduleDateRange
  ) => Promise<IpcResponse<ScheduleItem[]>>
  findById: (scheduleId: string) => Promise<IpcResponse<ScheduleItem>>
  create: (workspaceId: string, data: CreateScheduleData) => Promise<IpcResponse<ScheduleItem>>
  update: (scheduleId: string, data: UpdateScheduleData) => Promise<IpcResponse<ScheduleItem>>
  remove: (scheduleId: string) => Promise<IpcResponse<void>>
  move: (scheduleId: string, startAt: Date, endAt: Date) => Promise<IpcResponse<ScheduleItem>>
  linkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  unlinkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  getLinkedTodos: (scheduleId: string) => Promise<IpcResponse<TodoItem[]>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}
