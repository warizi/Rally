import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { isNotNull } from 'drizzle-orm'
import { canvases } from './canvas'

export type CanvasNodeType = 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
export const CANVAS_NODE_TYPES: CanvasNodeType[] = [
  'text',
  'todo',
  'note',
  'schedule',
  'csv',
  'pdf',
  'image'
]

export const canvasNodes = sqliteTable(
  'canvas_nodes',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']
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
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_canvas_nodes_canvas').on(t.canvasId),
    index('idx_canvas_nodes_ref').on(t.type, t.refId).where(isNotNull(t.refId))
  ]
)
