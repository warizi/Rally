import type { TodoItem } from '@entities/todo'
import type { RecurringCompletionItem } from '@entities/recurring-completion'

export type CompletedItem =
  | { type: 'todo'; completedAt: Date; todo: TodoItem }
  | { type: 'recurring'; completedAt: Date; recurringCompletion: RecurringCompletionItem }
