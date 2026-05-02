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
  /** subtodo인 경우 parent todo id */
  parentId: string | null
  /** subtodo인 경우 parent todo의 title */
  parentTitle: string | null
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
