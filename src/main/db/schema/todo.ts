import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // self-referential FK: lazy reference 필수 (초기화 순서 문제 방지)
  parentId: text('parent_id').references((): AnySQLiteColumn => todos.id, {
    onDelete: 'cascade'
  }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['할일', '진행중', '완료', '보류'] })
    .notNull()
    .default('할일'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
  listOrder: real('list_order').notNull().default(0),
  kanbanOrder: real('kanban_order').notNull().default(0),
  subOrder: real('sub_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  doneAt: integer('done_at', { mode: 'timestamp_ms' }),
  dueDate: integer('due_date', { mode: 'timestamp_ms' }),
  startDate: integer('start_date', { mode: 'timestamp_ms' })
})
