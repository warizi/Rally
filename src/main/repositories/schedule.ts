import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { schedules } from '../db/schema'

export type Schedule = typeof schedules.$inferSelect
export type ScheduleInsert = typeof schedules.$inferInsert

export const scheduleRepository = {
  findByWorkspaceId(workspaceId: string, rangeStart: Date, rangeEnd: Date): Schedule[] {
    return db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.workspaceId, workspaceId),
          lte(schedules.startAt, rangeEnd),
          gte(schedules.endAt, rangeStart)
        )
      )
      .orderBy(schedules.startAt)
      .all()
  },

  findById(id: string): Schedule | undefined {
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
      >
    >
  ): Schedule | undefined {
    return db.update(schedules).set(data).where(eq(schedules.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(schedules).where(eq(schedules.id, id)).run()
  },
}
