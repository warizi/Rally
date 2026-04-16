import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { terminalLayouts } from './terminal-layout'

export const terminalSessions = sqliteTable('terminal_sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  layoutId: text('layout_id').references(() => terminalLayouts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  cwd: text('cwd').notNull(),
  shell: text('shell').notNull().default('zsh'),
  rows: integer('rows').notNull().default(24),
  cols: integer('cols').notNull().default(80),
  screenSnapshot: text('screen_snapshot'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
