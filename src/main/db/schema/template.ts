import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type', { enum: ['note', 'csv'] }).notNull(),
  jsonData: text('json_data').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
})
