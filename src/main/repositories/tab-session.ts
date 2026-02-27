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

  upsertTabSession(data: TabSessionInsert): TabSession {
    return db
      .insert(tabSessions)
      .values(data)
      .onConflictDoUpdate({
        target: tabSessions.workspaceId,
        set: {
          tabsJson: data.tabsJson,
          panesJson: data.panesJson,
          layoutJson: data.layoutJson,
          activePaneId: data.activePaneId,
          updatedAt: data.updatedAt
        }
      })
      .returning()
      .get()
  }
}
