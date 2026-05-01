export type HistoryLinkType = 'note' | 'csv' | 'pdf' | 'image' | 'canvas'
export type HistoryEntryKind = 'todo' | 'recurring'

export interface HistoryLink {
  type: HistoryLinkType
  id: string
  title: string
  description: string | null
}

export interface HistoryTodoEntry {
  id: string
  title: string
  doneAt: Date
  links: HistoryLink[]
  kind: HistoryEntryKind
}

export interface HistoryDay {
  /** YYYY-MM-DD */
  date: string
  todos: HistoryTodoEntry[]
}

export interface HistoryFetchResult {
  days: HistoryDay[]
  hasMore: boolean
  nextDayOffset: number
}

export interface HistoryFetchOptions {
  dayOffset?: number
  dayLimit?: number
  fromDate?: string | null
  toDate?: string | null
  query?: string | null
}
