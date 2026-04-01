import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { db } from '../db'
import { recurringRules } from '../db/schema'

export type RecurringRule = typeof recurringRules.$inferSelect
export type RecurringRuleInsert = typeof recurringRules.$inferInsert

export const recurringRuleRepository = {
  findByWorkspaceId(workspaceId: string): RecurringRule[] {
    return db.select().from(recurringRules).where(eq(recurringRules.workspaceId, workspaceId)).all()
  },

  findById(id: string): RecurringRule | undefined {
    return db.select().from(recurringRules).where(eq(recurringRules.id, id)).get()
  },

  // startDate <= endOfDay AND (endDate IS NULL OR endDate >= startOfDay)
  // 요일 필터는 Service에서 처리
  findCandidatesOnDate(workspaceId: string, startOfDay: Date, endOfDay: Date): RecurringRule[] {
    return db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.workspaceId, workspaceId),
          lte(recurringRules.startDate, endOfDay),
          or(isNull(recurringRules.endDate), gte(recurringRules.endDate!, startOfDay))
        )
      )
      .all()
  },

  create(data: RecurringRuleInsert): RecurringRule {
    return db.insert(recurringRules).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        RecurringRule,
        | 'title'
        | 'description'
        | 'priority'
        | 'recurrenceType'
        | 'daysOfWeek'
        | 'startDate'
        | 'endDate'
        | 'startTime'
        | 'endTime'
        | 'reminderOffsetMs'
        | 'updatedAt'
      >
    >
  ): RecurringRule | undefined {
    return db.update(recurringRules).set(data).where(eq(recurringRules.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(recurringRules).where(eq(recurringRules.id, id)).run()
  }
}
