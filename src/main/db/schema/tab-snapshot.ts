import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const tabSnapshots = sqliteTable('tab_snapshots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  tabsJson: text('tabs_json').notNull(),
  panesJson: text('panes_json').notNull(),
  layoutJson: text('layout_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
