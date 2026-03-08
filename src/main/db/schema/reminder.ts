import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type', { enum: ['todo', 'schedule'] }).notNull(),
    entityId: text('entity_id').notNull(),
    offsetMs: integer('offset_ms').notNull(),
    remindAt: integer('remind_at', { mode: 'timestamp_ms' }).notNull(),
    isFired: integer('is_fired', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [
    index('idx_reminders_entity').on(table.entityType, table.entityId),
    index('idx_reminders_pending').on(table.isFired, table.remindAt)
  ]
)
