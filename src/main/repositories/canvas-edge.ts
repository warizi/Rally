import { eq } from 'drizzle-orm'
import { db } from '../db'
import { canvasEdges } from '../db/schema'

export type CanvasEdge = typeof canvasEdges.$inferSelect
export type CanvasEdgeInsert = typeof canvasEdges.$inferInsert

export const canvasEdgeRepository = {
  findByCanvasId(canvasId: string): CanvasEdge[] {
    return db.select().from(canvasEdges).where(eq(canvasEdges.canvasId, canvasId)).all()
  },

  findById(id: string): CanvasEdge | undefined {
    return db.select().from(canvasEdges).where(eq(canvasEdges.id, id)).get()
  },

  create(data: CanvasEdgeInsert): CanvasEdge {
    return db.insert(canvasEdges).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<CanvasEdge, 'fromSide' | 'toSide' | 'label' | 'color' | 'style' | 'arrow'>>
  ): CanvasEdge | undefined {
    return db.update(canvasEdges).set(data).where(eq(canvasEdges.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(canvasEdges).where(eq(canvasEdges.id, id)).run()
  }
}
