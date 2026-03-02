import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'

export const LINKABLE_ENTITY_TYPES: LinkableEntityType[] = [
  'csv',
  'image',
  'note',
  'pdf',
  'schedule',
  'todo'
]

export const entityLinks = sqliteTable(
  'entity_links',
  {
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    primaryKey({ columns: [t.sourceType, t.sourceId, t.targetType, t.targetId] }),
    index('idx_entity_links_target').on(t.targetType, t.targetId),
    index('idx_entity_links_workspace').on(t.workspaceId)
  ]
)
