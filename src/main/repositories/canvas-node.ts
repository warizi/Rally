import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { canvasNodes } from '../db/schema'
import type { CanvasNodeType } from '../db/schema/canvas-node'

export type CanvasNode = typeof canvasNodes.$inferSelect
export type CanvasNodeInsert = typeof canvasNodes.$inferInsert

export const canvasNodeRepository = {
  findByCanvasId(canvasId: string): CanvasNode[] {
    return db.select().from(canvasNodes).where(eq(canvasNodes.canvasId, canvasId)).all()
  },

  findById(id: string): CanvasNode | undefined {
    return db.select().from(canvasNodes).where(eq(canvasNodes.id, id)).get()
  },

  findByIds(ids: string[]): CanvasNode[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: CanvasNode[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(...db.select().from(canvasNodes).where(inArray(canvasNodes.id, chunk)).all())
    }
    return results
  },

  create(data: CanvasNodeInsert): CanvasNode {
    return db.insert(canvasNodes).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<CanvasNode, 'content' | 'color' | 'width' | 'height' | 'zIndex' | 'updatedAt'>
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
  }
}
