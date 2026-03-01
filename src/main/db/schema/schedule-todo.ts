import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { schedules } from './schedule'
import { todos } from './todo'

export const scheduleTodos = sqliteTable(
  'schedule_todos',
  {
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    todoId: text('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.todoId] })]
)
