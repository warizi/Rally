import type { IpcResponse, WatcherActor } from './common'
import type { RecurringCompletionItem } from './recurring'

export interface TodoItem {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  description: string
  status: '할일' | '진행중' | '완료' | '보류'
  priority: 'high' | 'medium' | 'low'
  isDone: boolean
  listOrder: number
  kanbanOrder: number
  subOrder: number
  createdAt: Date
  updatedAt: Date
  doneAt: Date | null
  dueDate: Date | null
  startDate: Date | null
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
}

export interface CreateTodoData {
  title: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  parentId?: string | null
  dueDate?: Date | null
  startDate?: Date | null
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
  dueDate?: Date | null
  startDate?: Date | null
}

export interface TodoOrderUpdate {
  id: string
  order: number
  status?: '할일' | '진행중' | '완료' | '보류'
}

export type TodoFindFilter = 'all' | 'active' | 'completed'

/** todo + recurring 완료를 한 목록으로 합친 항목 (findCompletedWithRecurring). */
export interface CompletedItem {
  type: 'todo' | 'recurring'
  completedAt: Date
  todo?: TodoItem
  recurringCompletion?: RecurringCompletionItem
}

export interface TodoAPI {
  findByWorkspace: (
    workspaceId: string,
    options?: { filter?: TodoFindFilter }
  ) => Promise<IpcResponse<TodoItem[]>>
  findByDateRange: (
    workspaceId: string,
    range: { start: Date; end: Date }
  ) => Promise<IpcResponse<TodoItem[]>>
  create: (workspaceId: string, data: CreateTodoData) => Promise<IpcResponse<TodoItem>>
  update: (todoId: string, data: UpdateTodoData) => Promise<IpcResponse<TodoItem>>
  remove: (todoId: string) => Promise<IpcResponse<void>>
  reorderList: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderKanban: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderSub: (parentId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  findCompletedWithRecurring: (workspaceId: string) => Promise<IpcResponse<CompletedItem[]>>
  onChanged: (
    callback: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
}
