import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { folders } from './folder'

export const csvFiles = sqliteTable(
  'csv_files',
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
    columnWidths: text('column_widths'),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [unique().on(t.workspaceId, t.relativePath)]
)
