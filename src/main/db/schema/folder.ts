import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { trashBatches } from './trash-batch'

export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    relativePath: text('relative_path').notNull(), // '/' 구분자, 워크스페이스 루트 기준
    color: text('color'),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    unique().on(t.workspaceId, t.relativePath),
    index('idx_folders_deleted').on(t.deletedAt),
    index('idx_folders_trash_batch').on(t.trashBatchId)
  ]
)
