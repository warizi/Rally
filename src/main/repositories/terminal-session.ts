import { db } from '../db'
import { terminalSessions } from '../db/schema/terminal-session'
import { and, eq } from 'drizzle-orm'

export type TerminalSession = typeof terminalSessions.$inferSelect
// id 포함 — IPC 핸들러에서 nanoid() 생성 후 전달
export type TerminalSessionInsert = Omit<TerminalSession, 'createdAt' | 'updatedAt'>

export const terminalSessionRepository = {
  findActiveByWorkspaceId(workspaceId: string): TerminalSession[] {
    return db
      .select()
      .from(terminalSessions)
      .where(and(eq(terminalSessions.workspaceId, workspaceId), eq(terminalSessions.isActive, 1)))
      .orderBy(terminalSessions.sortOrder)
      .all()
  },

  create(data: TerminalSessionInsert): TerminalSession {
    const now = new Date()
    return db
      .insert(terminalSessions)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning()
      .get()
  },

  update(
    id: string,
    data: Partial<
      Pick<TerminalSession, 'name' | 'cwd' | 'rows' | 'cols' | 'screenSnapshot' | 'sortOrder'>
    >
  ): void {
    db.update(terminalSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(terminalSessions.id, id))
      .run()
  },

  softDelete(id: string): void {
    db.update(terminalSessions)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(terminalSessions.id, id))
      .run()
  },

  saveSnapshot(id: string, screenSnapshot: string): void {
    db.update(terminalSessions)
      .set({ screenSnapshot, updatedAt: new Date() })
      .where(eq(terminalSessions.id, id))
      .run()
  }
}
