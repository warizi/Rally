import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { isNull } from 'drizzle-orm'
import { workspaces } from './workspace'
import { folders } from './folder'
import { trashBatches } from './trash-batch'

export const imageFiles = sqliteTable(
  'image_files',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    relativePath: text('relative_path').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    preview: text('preview').notNull().default(''),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    // 활성 row 끼리만 (workspace_id, relative_path) 유일성. 휴지통(deleted_at != NULL) 은 제외.
    uniqueIndex('uniq_image_files_active_path')
      .on(t.workspaceId, t.relativePath)
      .where(isNull(t.deletedAt)),
    index('idx_image_files_deleted').on(t.deletedAt),
    index('idx_image_files_trash_batch').on(t.trashBatchId)
  ]
)
