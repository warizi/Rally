import { eq } from 'drizzle-orm'
import { db } from '../db'
import { tabSnapshots } from '../db/schema'

export type TabSnapshot = typeof tabSnapshots.$inferSelect
export type TabSnapshotInsert = typeof tabSnapshots.$inferInsert
export type TabSnapshotUpdate = Partial<
  Pick<TabSnapshot, 'name' | 'description' | 'tabsJson' | 'panesJson' | 'layoutJson' | 'updatedAt'>
>

export const tabSnapshotRepository = {
  findByWorkspaceId(workspaceId: string): TabSnapshot[] {
    return db.select().from(tabSnapshots).where(eq(tabSnapshots.workspaceId, workspaceId)).all()
  },

  findById(id: string): TabSnapshot | undefined {
    return db.select().from(tabSnapshots).where(eq(tabSnapshots.id, id)).get()
  },

  create(data: TabSnapshotInsert): TabSnapshot {
    return db.insert(tabSnapshots).values(data).returning().get()
  },

  update(id: string, data: TabSnapshotUpdate): TabSnapshot | undefined {
    return db.update(tabSnapshots).set(data).where(eq(tabSnapshots.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(tabSnapshots).where(eq(tabSnapshots.id, id)).run()
  }
}
