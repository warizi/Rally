import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { recurringRules } from './recurring-rule'
import { workspaces } from './workspace'

export const recurringCompletions = sqliteTable(
  'recurring_completions',
  {
    id: text('id').primaryKey(),
    // 규칙 삭제 후에도 이력 보존: set null
    ruleId: text('rule_id').references(() => recurringRules.id, { onDelete: 'set null' }),
    // 규칙 삭제 후 표시용 제목 스냅샷
    ruleTitle: text('rule_title').notNull(),
    // 규칙 삭제 후에도 workspace 기준 조회 가능하도록 직접 저장
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // 'YYYY-MM-DD' 형태로 저장
    completedDate: text('completed_date').notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    unique('uq_recurring_completion').on(t.ruleId, t.completedDate),
    index('idx_recurring_completions_workspace_date').on(t.workspaceId, t.completedDate),
    index('idx_recurring_completions_rule').on(t.ruleId)
  ]
)
