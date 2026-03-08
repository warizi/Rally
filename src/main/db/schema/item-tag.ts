import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { tags } from './tag'

export const itemTags = sqliteTable(
  'item_tags',
  {
    id: text('id').primaryKey(),
    itemType: text('item_type').notNull(),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    unique().on(t.itemType, t.tagId, t.itemId),
    index('idx_item_tags_item').on(t.itemType, t.itemId),
    index('idx_item_tags_tag').on(t.tagId)
  ]
)
