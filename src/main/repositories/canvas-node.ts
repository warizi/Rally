import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db'
import { canvasNodes } from '../db/schema'
import type { CanvasNodeType } from '../db/schema/canvas-node'

export type CanvasNode = typeof canvasNodes.$inferSelect
export type CanvasNodeInsert = typeof canvasNodes.$inferInsert

const NOT_DELETED = isNull(canvasNodes.deletedAt)

export const canvasNodeRepository = {
  findByCanvasId(canvasId: string): CanvasNode[] {
    return db
      .select()
      .from(canvasNodes)
      .where(and(eq(canvasNodes.canvasId, canvasId), NOT_DELETED))
      .all()
  },

  findById(id: string): CanvasNode | undefined {
    return db
      .select()
      .from(canvasNodes)
      .where(and(eq(canvasNodes.id, id), NOT_DELETED))
      .get()
  },

  findByIds(ids: string[]): CanvasNode[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: CanvasNode[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(
        ...db
          .select()
          .from(canvasNodes)
          .where(and(inArray(canvasNodes.id, chunk), NOT_DELETED))
          .all()
      )
    }
    return results
  },

  create(data: CanvasNodeInsert): CanvasNode {
    return db.insert(canvasNodes).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        CanvasNode,
        | 'content'
        | 'color'
        | 'width'
        | 'height'
        | 'zIndex'
        | 'updatedAt'
        | 'deletedAt'
        | 'trashBatchId'
      >
    >
  ): CanvasNode | undefined {
    return db.update(canvasNodes).set(data).where(eq(canvasNodes.id, id)).returning().get()
  },

  bulkUpdatePositions(updates: { id: string; x: number; y: number }[]): void {
    if (updates.length === 0) return
    const now = Date.now()
    const stmt = db.$client.prepare(
      'UPDATE canvas_nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?'
    )
    db.$client.transaction(() => {
      for (const u of updates) {
        stmt.run(u.x, u.y, now, u.id)
      }
    })()
  },

  delete(id: string): void {
    db.delete(canvasNodes).where(eq(canvasNodes.id, id)).run()
  },

  deleteByRef(type: CanvasNodeType, refId: string): void {
    db.delete(canvasNodes)
      .where(and(eq(canvasNodes.type, type), eq(canvasNodes.refId, refId)))
      .run()
  },

  deleteByCanvasId(canvasId: string): void {
    db.delete(canvasNodes).where(eq(canvasNodes.canvasId, canvasId)).run()
  },

  /** trashService cascade — 휴지통 row 포함 */
  findByCanvasIdIncludingDeleted(canvasId: string): CanvasNode[] {
    return db.select().from(canvasNodes).where(eq(canvasNodes.canvasId, canvasId)).all()
  },

  findByTrashBatchId(batchId: string): CanvasNode[] {
    return db.select().from(canvasNodes).where(eq(canvasNodes.trashBatchId, batchId)).all()
  },

  /** trashService.list가 휴지통 카드의 자식 카운트 산출용 */
  countInTrashByCanvasId(canvasId: string): number {
    return db
      .select()
      .from(canvasNodes)
      .where(and(eq(canvasNodes.canvasId, canvasId), isNotNull(canvasNodes.deletedAt)))
      .all().length
  },

  bulkCreate(nodes: CanvasNodeInsert[]): void {
    if (nodes.length === 0) return
    db.insert(canvasNodes).values(nodes).run()
  }
}
