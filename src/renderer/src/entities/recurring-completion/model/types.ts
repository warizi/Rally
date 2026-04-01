import type { TodoItem } from '@entities/todo'

export interface RecurringCompletionItem {
  id: string
  ruleId: string | null
  ruleTitle: string
  workspaceId: string
  completedDate: string
  completedAt: Date
  createdAt: Date
}

export type CompletedItem =
  | { type: 'todo'; completedAt: Date; todo: TodoItem }
  | { type: 'recurring'; completedAt: Date; recurringCompletion: RecurringCompletionItem }
