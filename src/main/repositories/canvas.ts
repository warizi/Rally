import { eq } from 'drizzle-orm'
import { db } from '../db'
import { canvases } from '../db/schema'

export type Canvas = typeof canvases.$inferSelect
export type CanvasInsert = typeof canvases.$inferInsert

export const canvasRepository = {
  findByWorkspaceId(workspaceId: string): Canvas[] {
    return db.select().from(canvases).where(eq(canvases.workspaceId, workspaceId)).all()
  },

  findById(id: string): Canvas | undefined {
    return db.select().from(canvases).where(eq(canvases.id, id)).get()
  },

  create(data: CanvasInsert): Canvas {
    return db.insert(canvases).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<Canvas, 'title' | 'description' | 'updatedAt'>>
  ): Canvas | undefined {
    return db.update(canvases).set(data).where(eq(canvases.id, id)).returning().get()
  },

  updateViewport(
    id: string,
    viewport: { viewportX: number; viewportY: number; viewportZoom: number }
  ): void {
    db.update(canvases).set(viewport).where(eq(canvases.id, id)).run()
  },

  delete(id: string): void {
    db.delete(canvases).where(eq(canvases.id, id)).run()
  }
}
