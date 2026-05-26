import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'
import { trashBatches } from './trash-batch'

export const schedules = sqliteTable(
  'schedules',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
    startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(),
    endAt: integer('end_at', { mode: 'timestamp_ms' }).notNull(),
    color: text('color'),
    priority: text('priority', { enum: ['low', 'medium', 'high'] })
      .notNull()
      .default('medium'),
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
    index('idx_schedules_deleted').on(t.deletedAt),
    index('idx_schedules_trash_batch').on(t.trashBatchId)
  ]
)
