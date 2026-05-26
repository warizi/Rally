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
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    createdBy: text('created_by', { enum: ['user', 'ai'] })
      .notNull()
      .default('user'),
    createdById: text('created_by_id'),
    updatedBy: text('updated_by', { enum: ['user', 'ai'] })
      .notNull()
      .default('user'),
    updatedById: text('updated_by_id')
  },
  (t) => [unique().on(t.workspaceId, t.name)]
)
