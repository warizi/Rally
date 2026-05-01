import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { canvasEdges } from '../db/schema'

export type CanvasEdge = typeof canvasEdges.$inferSelect
export type CanvasEdgeInsert = typeof canvasEdges.$inferInsert

const NOT_DELETED = isNull(canvasEdges.deletedAt)

export const canvasEdgeRepository = {
  findByCanvasId(canvasId: string): CanvasEdge[] {
    return db
      .select()
      .from(canvasEdges)
      .where(and(eq(canvasEdges.canvasId, canvasId), NOT_DELETED))
      .all()
  },

  findById(id: string): CanvasEdge | undefined {
    return db
      .select()
      .from(canvasEdges)
      .where(and(eq(canvasEdges.id, id), NOT_DELETED))
      .get()
  },

  create(data: CanvasEdgeInsert): CanvasEdge {
    return db.insert(canvasEdges).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        CanvasEdge,
        'fromSide' | 'toSide' | 'label' | 'color' | 'style' | 'arrow' | 'deletedAt' | 'trashBatchId'
      >
    >
  ): CanvasEdge | undefined {
    return db.update(canvasEdges).set(data).where(eq(canvasEdges.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(canvasEdges).where(eq(canvasEdges.id, id)).run()
  },

  deleteByCanvasId(canvasId: string): void {
    db.delete(canvasEdges).where(eq(canvasEdges.canvasId, canvasId)).run()
  },

  findByCanvasIdIncludingDeleted(canvasId: string): CanvasEdge[] {
    return db.select().from(canvasEdges).where(eq(canvasEdges.canvasId, canvasId)).all()
  },

  findByTrashBatchId(batchId: string): CanvasEdge[] {
    return db.select().from(canvasEdges).where(eq(canvasEdges.trashBatchId, batchId)).all()
  },

  bulkCreate(edges: CanvasEdgeInsert[]): void {
    if (edges.length === 0) return
    db.insert(canvasEdges).values(edges).run()
  }
}
