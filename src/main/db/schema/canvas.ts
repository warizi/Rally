import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { trashBatches } from './trash-batch'

export const canvases = sqliteTable(
  'canvases',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    viewportX: real('viewport_x').notNull().default(0),
    viewportY: real('viewport_y').notNull().default(0),
    viewportZoom: real('viewport_zoom').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    index('idx_canvases_workspace').on(t.workspaceId),
    index('idx_canvases_deleted').on(t.deletedAt),
    index('idx_canvases_trash_batch').on(t.trashBatchId)
  ]
)
