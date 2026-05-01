import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from '../db'
import { entityLinks } from '../db/schema'

export type EntityLink = typeof entityLinks.$inferSelect
export type EntityLinkInsert = typeof entityLinks.$inferInsert

export const entityLinkRepository = {
  link(data: EntityLinkInsert): void {
    db.insert(entityLinks).values(data).onConflictDoNothing().run()
  },

  unlink(sourceType: string, sourceId: string, targetType: string, targetId: string): void {
    db.delete(entityLinks)
      .where(
        and(
          eq(entityLinks.sourceType, sourceType),
          eq(entityLinks.sourceId, sourceId),
          eq(entityLinks.targetType, targetType),
          eq(entityLinks.targetId, targetId)
        )
      )
      .run()
  },

  findByEntity(entityType: string, entityId: string): EntityLink[] {
    return db
      .select()
      .from(entityLinks)
      .where(
        or(
          and(eq(entityLinks.sourceType, entityType), eq(entityLinks.sourceId, entityId)),
          and(eq(entityLinks.targetType, entityType), eq(entityLinks.targetId, entityId))
        )
      )
      .all()
  },

  /**
   * 여러 entity의 링크를 단일 쿼리로 일괄 조회 (N+1 회피용).
   * sourceType/sourceId 또는 targetType/targetId가 매칭되는 모든 링크 반환.
   */
  findByEntities(entityType: string, entityIds: string[]): EntityLink[] {
    if (entityIds.length === 0) return []
    return db
      .select()
      .from(entityLinks)
      .where(
        or(
          and(eq(entityLinks.sourceType, entityType), inArray(entityLinks.sourceId, entityIds)),
          and(eq(entityLinks.targetType, entityType), inArray(entityLinks.targetId, entityIds))
        )
      )
      .all()
  },

  removeAllByEntity(entityType: string, entityId: string): void {
    db.delete(entityLinks)
      .where(
        or(
          and(eq(entityLinks.sourceType, entityType), eq(entityLinks.sourceId, entityId)),
          and(eq(entityLinks.targetType, entityType), eq(entityLinks.targetId, entityId))
        )
      )
      .run()
  },

  removeAllByEntities(entityType: string, entityIds: string[]): void {
    for (const id of entityIds) {
      this.removeAllByEntity(entityType, id)
    }
  }
}
