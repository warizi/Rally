import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export type TaggableEntityType = 'note' | 'todo' | 'image' | 'pdf' | 'csv' | 'canvas' | 'folder'

export const TAGGABLE_ENTITY_TYPES: TaggableEntityType[] = [
  'canvas',
  'csv',
  'folder',
  'image',
  'note',
  'pdf',
  'todo'
]

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [unique().on(t.workspaceId, t.name)]
)
