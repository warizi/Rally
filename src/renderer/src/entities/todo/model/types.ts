export type TodoStatus = '할일' | '진행중' | '완료' | '보류'
export type TodoPriority = 'high' | 'medium' | 'low'

export const TODO_STATUS: TodoStatus[] = ['할일', '진행중', '완료', '보류']
export const TODO_PRIORITY: TodoPriority[] = ['high', 'medium', 'low']

export interface TodoItem {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  description: string
  status: TodoStatus
  priority: TodoPriority
  isDone: boolean
  listOrder: number
  kanbanOrder: number
  subOrder: number
  createdAt: Date
  updatedAt: Date
  doneAt: Date | null
  dueDate: Date | null
  startDate: Date | null
}

export interface CreateTodoData {
  title: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  parentId?: string | null
  dueDate?: Date | null
  startDate?: Date | null
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  isDone?: boolean
  dueDate?: Date | null
  startDate?: Date | null
}

export interface TodoOrderUpdate {
  id: string
  order: number
  status?: TodoStatus
}
