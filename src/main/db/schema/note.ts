import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { folders } from './folder'
import { trashBatches } from './trash-batch'

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    relativePath: text('relative_path').notNull(), // '/' 구분자, workspace 루트 기준
    title: text('title').notNull(), // 파일명 (.md 제외), 화면 표시용
    description: text('description').notNull().default(''),
    preview: text('preview').notNull().default(''), // 내용 앞부분 최대 200자
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    /** 휴지통 이동 시각 — NULL이면 활성 row */
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    /** 같은 사용자 액션으로 묶인 trash batch 참조 */
    trashBatchId: text('trash_batch_id').references(() => trashBatches.id, {
      onDelete: 'set null'
    })
  },
  (t) => [
    unique().on(t.workspaceId, t.relativePath),
    index('idx_notes_deleted').on(t.deletedAt),
    index('idx_notes_trash_batch').on(t.trashBatchId)
  ]
)
