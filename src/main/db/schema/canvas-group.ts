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
    // 중첩 그룹 — 부모 그룹 id(자기참조). SQLite 는 ALTER TABLE ADD COLUMN 에 REFERENCES 를
    // 허용하지 않으므로 선언적 FK 없이 plain text 로 둔다. 부모 삭제 시 자식 고아화는
    // 서비스(canvasGroupRepository.clearParentId)에서 명시적으로 처리한다.
    parentId: text('parent_id'),
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
    index('idx_canvas_groups_parent').on(t.parentId),
    index('idx_canvas_groups_deleted').on(t.deletedAt),
    index('idx_canvas_groups_trash_batch').on(t.trashBatchId)
  ]
)
