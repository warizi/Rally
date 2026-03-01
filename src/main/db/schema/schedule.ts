import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
  startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp_ms' }).notNull(),
  color: text('color'),
  priority: text('priority', { enum: ['low', 'medium', 'high'] }).notNull().default('medium'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})
