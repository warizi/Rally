import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { canvases } from './canvas'

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
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvas_groups_canvas').on(t.canvasId)]
)
