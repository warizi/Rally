import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const recurringRules = sqliteTable(
  'recurring_rules',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    priority: text('priority', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),
    recurrenceType: text('recurrence_type', {
      enum: ['daily', 'weekday', 'weekend', 'custom']
    }).notNull(),
    // custom 타입에서 사용: '1,3,5' 형태 (0=일, 1=월 ... 6=토)
    daysOfWeek: text('days_of_week'),
    startDate: integer('start_date', { mode: 'timestamp_ms' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp_ms' }),
    startTime: text('start_time'),
    endTime: text('end_time'),
    reminderOffsetMs: integer('reminder_offset_ms'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_recurring_rules_workspace').on(t.workspaceId)]
)
