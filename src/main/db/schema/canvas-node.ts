import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { isNotNull } from 'drizzle-orm'
import { canvases } from './canvas'
import { trashBatches } from './trash-batch'

export type CanvasNodeType =
  | 'text'
  | 'todo'
  | 'note'
  | 'schedule'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'canvas'
export const CANVAS_NODE_TYPES: CanvasNodeType[] = [
  'text',
  'todo',
  'note',
  'schedule',
  'csv',
  'pdf',
  'image',
  'canvas'
]

export const canvasNodes = sqliteTable(
  'canvas_nodes',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image', 'canvas']
    }).notNull(),
    refId: text('ref_id'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull().default(260),
    height: real('height').notNull().default(160),
    color: text('color'),
    content: text('content'),
    zIndex: integer('z_index').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    index('idx_canvas_nodes_canvas').on(t.canvasId),
    index('idx_canvas_nodes_ref').on(t.type, t.refId).where(isNotNull(t.refId)),
    index('idx_canvas_nodes_deleted').on(t.deletedAt),
    index('idx_canvas_nodes_trash_batch').on(t.trashBatchId)
  ]
)
