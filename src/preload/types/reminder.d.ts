import type { IpcResponse } from './common'

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

export interface ReminderAPI {
  findByEntity: (
    entityType: 'todo' | 'schedule',
    entityId: string
  ) => Promise<IpcResponse<ReminderItem[]>>
  set: (data: SetReminderData) => Promise<IpcResponse<ReminderItem>>
  remove: (reminderId: string) => Promise<IpcResponse<void>>
  removeByEntity: (entityType: 'todo' | 'schedule', entityId: string) => Promise<IpcResponse<void>>
  onFired: (
    callback: (data: {
      entityType: string
      entityId: string
      title: string
      workspaceId: string | null
    }) => void
  ) => () => void
  onChanged: (callback: (workspaceId: string) => void) => () => void
}
