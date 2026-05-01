import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { trashBatches } from './trash-batch'

export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type', { enum: ['note', 'csv'] }).notNull(),
    jsonData: text('json_data').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    index('idx_templates_deleted').on(t.deletedAt),
    index('idx_templates_trash_batch').on(t.trashBatchId)
  ]
)
