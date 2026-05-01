import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { canvases } from './canvas'
import { canvasNodes } from './canvas-node'
import { trashBatches } from './trash-batch'

export const canvasEdges = sqliteTable(
  'canvas_edges',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    fromNode: text('from_node')
      .notNull()
      .references(() => canvasNodes.id, { onDelete: 'cascade' }),
    toNode: text('to_node')
      .notNull()
      .references(() => canvasNodes.id, { onDelete: 'cascade' }),
    fromSide: text('from_side', { enum: ['top', 'right', 'bottom', 'left'] })
      .notNull()
      .default('right'),
    toSide: text('to_side', { enum: ['top', 'right', 'bottom', 'left'] })
      .notNull()
      .default('left'),
    label: text('label'),
    color: text('color'),
    style: text('style', { enum: ['solid', 'dashed', 'dotted'] })
      .notNull()
      .default('solid'),
    arrow: text('arrow', { enum: ['none', 'end', 'both'] })
      .notNull()
      .default('end'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    index('idx_canvas_edges_canvas').on(t.canvasId),
    index('idx_canvas_edges_deleted').on(t.deletedAt),
    index('idx_canvas_edges_trash_batch').on(t.trashBatchId)
  ]
)
