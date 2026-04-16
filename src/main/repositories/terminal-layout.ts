import { db } from '../db'
import { terminalLayouts } from '../db/schema/terminal-layout'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export type TerminalLayout = typeof terminalLayouts.$inferSelect

export const terminalLayoutRepository = {
  findByWorkspaceId(workspaceId: string): TerminalLayout | undefined {
    return db
      .select()
      .from(terminalLayouts)
      .where(eq(terminalLayouts.workspaceId, workspaceId))
      .get()
  },

  upsert(workspaceId: string, layoutJson: string): TerminalLayout {
    const now = new Date()
    return db
      .insert(terminalLayouts)
      .values({ id: nanoid(), workspaceId, layoutJson, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: terminalLayouts.workspaceId,
        set: { layoutJson, updatedAt: now }
      })
      .returning()
      .get()
  }
}
