import { and, eq, inArray, isNotNull, isNull, like, or } from 'drizzle-orm'
import { db } from '../db'
import { canvases } from '../db/schema'

export type Canvas = typeof canvases.$inferSelect
export type CanvasInsert = typeof canvases.$inferInsert

const NOT_DELETED = isNull(canvases.deletedAt)

export const canvasRepository = {
  findByWorkspaceId(workspaceId: string, search?: string): Canvas[] {
    const conditions = [eq(canvases.workspaceId, workspaceId), NOT_DELETED]
    if (search) {
      const pattern = `%${search}%`
      conditions.push(or(like(canvases.title, pattern), like(canvases.description, pattern))!)
    }
    return db
      .select()
      .from(canvases)
      .where(and(...conditions))
      .all()
  },

  findById(id: string): Canvas | undefined {
    return db
      .select()
      .from(canvases)
      .where(and(eq(canvases.id, id), NOT_DELETED))
      .get()
  },

  findByIdIncludingDeleted(id: string): Canvas | undefined {
    return db.select().from(canvases).where(eq(canvases.id, id)).get()
  },

  findByIds(ids: string[]): Canvas[] {
    if (ids.length === 0) return []
    return db
      .select()
      .from(canvases)
      .where(and(inArray(canvases.id, ids), NOT_DELETED))
      .all()
  },

  create(data: CanvasInsert): Canvas {
    return db.insert(canvases).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<Canvas, 'title' | 'description' | 'updatedAt' | 'deletedAt' | 'trashBatchId'>
    >
  ): Canvas | undefined {
    return db.update(canvases).set(data).where(eq(canvases.id, id)).returning().get()
  },

  updateViewport(
    id: string,
    viewport: { viewportX: number; viewportY: number; viewportZoom: number }
  ): void {
    db.update(canvases).set(viewport).where(eq(canvases.id, id)).run()
  },

  findInTrashByWorkspaceId(workspaceId: string): Canvas[] {
    return db
      .select()
      .from(canvases)
      .where(and(eq(canvases.workspaceId, workspaceId), isNotNull(canvases.deletedAt)))
      .all()
  },

  findByTrashBatchId(batchId: string): Canvas[] {
    return db.select().from(canvases).where(eq(canvases.trashBatchId, batchId)).all()
  },

  delete(id: string): void {
    db.delete(canvases).where(eq(canvases.id, id)).run()
  }
}
