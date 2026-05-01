import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db'
import { canvasGroups } from '../db/schema'

export type CanvasGroup = typeof canvasGroups.$inferSelect
export type CanvasGroupInsert = typeof canvasGroups.$inferInsert

const NOT_DELETED = isNull(canvasGroups.deletedAt)

export const canvasGroupRepository = {
  findByCanvasId(canvasId: string): CanvasGroup[] {
    return db
      .select()
      .from(canvasGroups)
      .where(and(eq(canvasGroups.canvasId, canvasId), NOT_DELETED))
      .all()
  },

  /** trashService cascade 수집용 — 휴지통 row 포함 */
  findByCanvasIdIncludingDeleted(canvasId: string): CanvasGroup[] {
    return db.select().from(canvasGroups).where(eq(canvasGroups.canvasId, canvasId)).all()
  },

  findById(id: string): CanvasGroup | undefined {
    return db
      .select()
      .from(canvasGroups)
      .where(and(eq(canvasGroups.id, id), NOT_DELETED))
      .get()
  },

  findByIds(ids: string[]): CanvasGroup[] {
    if (ids.length === 0) return []
    return db
      .select()
      .from(canvasGroups)
      .where(and(inArray(canvasGroups.id, ids), NOT_DELETED))
      .all()
  },

  findByTrashBatchId(batchId: string): CanvasGroup[] {
    return db.select().from(canvasGroups).where(eq(canvasGroups.trashBatchId, batchId)).all()
  },

  findInTrashByWorkspaceId(workspaceId: string): CanvasGroup[] {
    // canvas-group은 워크스페이스 직접 FK 아님 — canvas 통해 간접. trash batch는 별도 추적되므로
    // 통상은 findByTrashBatchId로 충분. 이 메서드는 디버깅·관리용.
    void workspaceId
    return db.select().from(canvasGroups).where(isNotNull(canvasGroups.deletedAt)).all()
  },

  create(data: CanvasGroupInsert): CanvasGroup {
    return db.insert(canvasGroups).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        CanvasGroup,
        | 'label'
        | 'x'
        | 'y'
        | 'width'
        | 'height'
        | 'color'
        | 'updatedAt'
        | 'deletedAt'
        | 'trashBatchId'
      >
    >
  ): CanvasGroup | undefined {
    return db.update(canvasGroups).set(data).where(eq(canvasGroups.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(canvasGroups).where(eq(canvasGroups.id, id)).run()
  },

  bulkCreate(items: CanvasGroupInsert[]): void {
    if (items.length === 0) return
    db.insert(canvasGroups).values(items).run()
  }
}
