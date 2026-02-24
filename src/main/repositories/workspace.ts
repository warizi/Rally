import { eq } from 'drizzle-orm'
import { db } from '../db'
import { workspaces } from '../db/schema'

export type Workspace = typeof workspaces.$inferSelect
export type WorkspaceInsert = typeof workspaces.$inferInsert
export type WorkspaceUpdate = Partial<Pick<Workspace, 'name' | 'path' | 'updatedAt'>>

export const workspaceRepository = {
  findAll(): Workspace[] {
    return db.select().from(workspaces).all()
  },

  findById(id: string): Workspace | undefined {
    return db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  },

  create(data: WorkspaceInsert): Workspace {
    return db.insert(workspaces).values(data).returning().get()
  },

  update(id: string, data: WorkspaceUpdate): Workspace | undefined {
    return db.update(workspaces).set(data).where(eq(workspaces.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(workspaces).where(eq(workspaces.id, id)).run()
  }
}
