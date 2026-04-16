import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const terminalLayouts = sqliteTable('terminal_layouts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  layoutJson: text('layout_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
