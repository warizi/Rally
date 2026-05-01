import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { canvases } from './canvas'
import { trashBatches } from './trash-batch'

export const canvasGroups = sqliteTable(
  'canvas_groups',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    label: text('label'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull(),
    height: real('height').notNull(),
    color: text('color'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    index('idx_canvas_groups_canvas').on(t.canvasId),
    index('idx_canvas_groups_deleted').on(t.deletedAt),
    index('idx_canvas_groups_trash_batch').on(t.trashBatchId)
  ]
)
