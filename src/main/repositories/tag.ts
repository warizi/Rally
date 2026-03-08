import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { tags } from '../db/schema'

export type Tag = typeof tags.$inferSelect
export type TagInsert = typeof tags.$inferInsert

export const tagRepository = {
  findByWorkspaceId(workspaceId: string): Tag[] {
    return db.select().from(tags).where(eq(tags.workspaceId, workspaceId)).all()
  },

  findById(id: string): Tag | undefined {
    return db.select().from(tags).where(eq(tags.id, id)).get()
  },

  findByName(workspaceId: string, name: string): Tag | undefined {
    return db
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, name)))
      .get()
  },

  create(data: TagInsert): Tag {
    return db.insert(tags).values(data).returning().get()
  },

  update(id: string, data: Partial<Pick<Tag, 'name' | 'color' | 'description'>>): Tag | undefined {
    return db.update(tags).set(data).where(eq(tags.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(tags).where(eq(tags.id, id)).run()
  }
}
