import { db } from '../db'
import { tabSessions } from '../db/schema/tab-session'
import { eq } from 'drizzle-orm'

export type TabSession = typeof tabSessions.$inferSelect
export type TabSessionInsert = Omit<TabSession, 'id'>

export const tabSessionRepository = {
  findById(id: number): TabSession | undefined {
    return db.select().from(tabSessions).where(eq(tabSessions.id, id)).get()
  },

  findTabSessionByWorkspaceId(workspaceId: string): TabSession | undefined {
    return db.select().from(tabSessions).where(eq(tabSessions.workspaceId, workspaceId)).get()
  },

  createTabSession(data: TabSessionInsert): TabSession | undefined {
    return db.insert(tabSessions).values(data).returning().get()
  },

  updateTabSession(data: TabSession): TabSession | undefined {
    return db
      .update(tabSessions)
      .set(data)
      .where(eq(tabSessions.workspaceId, data.workspaceId))
      .returning()
      .get()
  }
}
