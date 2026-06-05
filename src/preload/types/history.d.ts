import type { IpcResponse } from './common'

export type HistoryLinkType = 'note' | 'csv' | 'pdf' | 'image' | 'canvas'

export interface HistoryLink {
  type: HistoryLinkType
  id: string
  title: string
  description: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
  updatedAt: Date
}

export type HistoryEntryKind = 'todo' | 'recurring'

export interface HistoryTodoEntry {
  id: string
  title: string
  doneAt: Date
  links: HistoryLink[]
  kind: HistoryEntryKind
  parentId: string | null
  parentTitle: string | null
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
}

export interface HistoryDay {
  date: string
  todos: HistoryTodoEntry[]
}

export interface HistoryFetchResult {
  days: HistoryDay[]
  hasMore: boolean
  nextDayOffset: number
}

export interface HistoryAPI {
  fetch: (
    workspaceId: string,
    options?: {
      dayOffset?: number
      dayLimit?: number
      fromDate?: string | null
      toDate?: string | null
      query?: string | null
    }
  ) => Promise<IpcResponse<HistoryFetchResult>>
}
