import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { isNull } from 'drizzle-orm'
import { workspaces } from './workspace'
import { folders } from './folder'
import { trashBatches } from './trash-batch'

export const pdfFiles = sqliteTable(
  'pdf_files',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    relativePath: text('relative_path').notNull(),
    /** 파일시스템 inode 번호 (BigInt → 문자열). rename/move identity 추적용 — P2 */
    ino: text('ino'),
    /** 볼륨 식별자(st_dev). ino 는 볼륨 내에서만 유일하므로 반드시 쌍으로 비교 */
    dev: text('dev'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    preview: text('preview').notNull().default(''),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    createdBy: text('created_by', { enum: ['user', 'ai'] })
      .notNull()
      .default('user'),
    createdById: text('created_by_id'),
    updatedBy: text('updated_by', { enum: ['user', 'ai'] })
      .notNull()
      .default('user'),
    updatedById: text('updated_by_id'),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    // 활성 row 끼리만 (workspace_id, relative_path) 유일성. 휴지통(deleted_at != NULL) 은 제외.
    uniqueIndex('uniq_pdf_files_active_path')
      .on(t.workspaceId, t.relativePath)
      .where(isNull(t.deletedAt)),
    // 비유니크 — 하드링크·exFAT ino 재사용 가능성 때문에 unique 금지
    index('idx_pdf_files_ino').on(t.workspaceId, t.ino),
    index('idx_pdf_files_deleted').on(t.deletedAt),
    index('idx_pdf_files_trash_batch').on(t.trashBatchId)
  ]
)
