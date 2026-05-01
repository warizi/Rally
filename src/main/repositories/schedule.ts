import { and, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import { db } from '../db'
import { schedules } from '../db/schema'

export type Schedule = typeof schedules.$inferSelect
export type ScheduleInsert = typeof schedules.$inferInsert

const NOT_DELETED = isNull(schedules.deletedAt)

export const scheduleRepository = {
  findByWorkspaceId(workspaceId: string, rangeStart: Date, rangeEnd: Date): Schedule[] {
    return db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.workspaceId, workspaceId),
          NOT_DELETED,
          lte(schedules.startAt, rangeEnd),
          gte(schedules.endAt, rangeStart)
        )
      )
      .orderBy(schedules.startAt)
      .all()
  },

  findAllByWorkspaceId(workspaceId: string): Schedule[] {
    return db
      .select()
      .from(schedules)
      .where(and(eq(schedules.workspaceId, workspaceId), NOT_DELETED))
      .orderBy(schedules.startAt)
      .all()
  },

  findById(id: string): Schedule | undefined {
    return db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), NOT_DELETED))
      .get()
  },

  findByIdIncludingDeleted(id: string): Schedule | undefined {
    return db.select().from(schedules).where(eq(schedules.id, id)).get()
  },

  create(data: ScheduleInsert): Schedule {
    return db.insert(schedules).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        Schedule,
        | 'title'
        | 'description'
        | 'location'
        | 'allDay'
        | 'startAt'
        | 'endAt'
        | 'color'
        | 'priority'
        | 'updatedAt'
        | 'deletedAt'
        | 'trashBatchId'
      >
    >
  ): Schedule | undefined {
    return db.update(schedules).set(data).where(eq(schedules.id, id)).returning().get()
  },

  findByIds(ids: string[]): Schedule[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: Schedule[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(
        ...db
          .select()
          .from(schedules)
          .where(and(inArray(schedules.id, chunk), NOT_DELETED))
          .all()
      )
    }
    return results
  },

  findInTrashByWorkspaceId(workspaceId: string): Schedule[] {
    return db
      .select()
      .from(schedules)
      .where(and(eq(schedules.workspaceId, workspaceId), isNotNull(schedules.deletedAt)))
      .all()
  },

  findByTrashBatchId(batchId: string): Schedule[] {
    return db.select().from(schedules).where(eq(schedules.trashBatchId, batchId)).all()
  },

  delete(id: string): void {
    db.delete(schedules).where(eq(schedules.id, id)).run()
  }
}
