import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { itemTags } from '../db/schema'

export type ItemTag = typeof itemTags.$inferSelect
export type ItemTagInsert = typeof itemTags.$inferInsert

export const itemTagRepository = {
  findByItem(itemType: string, itemId: string): ItemTag[] {
    return db
      .select()
      .from(itemTags)
      .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
      .all()
  },

  findByTag(tagId: string): ItemTag[] {
    return db.select().from(itemTags).where(eq(itemTags.tagId, tagId)).all()
  },

  attach(data: ItemTagInsert): void {
    db.insert(itemTags).values(data).onConflictDoNothing().run()
  },

  detach(itemType: string, tagId: string, itemId: string): void {
    db.delete(itemTags)
      .where(
        and(eq(itemTags.itemType, itemType), eq(itemTags.tagId, tagId), eq(itemTags.itemId, itemId))
      )
      .run()
  },

  detachAllByItem(itemType: string, itemId: string): void {
    db.delete(itemTags)
      .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
      .run()
  },

  detachAllByTag(tagId: string): void {
    db.delete(itemTags).where(eq(itemTags.tagId, tagId)).run()
  }
}
