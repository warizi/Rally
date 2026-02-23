import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const tabSessions = sqliteTable('tab_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  tabsJson: text('tabs_json').notNull(), // Record<string, tab>
  panesJson: text('panes_json').notNull(), // Record<string, Pane>
  layoutJson: text('layout_json').notNull(), // LayoutNode
  activePaneId: text('active_pane_id').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
