import { and, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm'
import { db } from '../db'
import { recurringRules } from '../db/schema'

export type RecurringRule = typeof recurringRules.$inferSelect
export type RecurringRuleInsert = typeof recurringRules.$inferInsert

const NOT_DELETED = isNull(recurringRules.deletedAt)

export const recurringRuleRepository = {
  findByWorkspaceId(workspaceId: string): RecurringRule[] {
    return db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.workspaceId, workspaceId), NOT_DELETED))
      .all()
  },

  findById(id: string): RecurringRule | undefined {
    return db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.id, id), NOT_DELETED))
      .get()
  },

  findByIdIncludingDeleted(id: string): RecurringRule | undefined {
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
          NOT_DELETED,
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
        | 'deletedAt'
        | 'trashBatchId'
      >
    >
  ): RecurringRule | undefined {
    return db.update(recurringRules).set(data).where(eq(recurringRules.id, id)).returning().get()
  },

  findInTrashByWorkspaceId(workspaceId: string): RecurringRule[] {
    return db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.workspaceId, workspaceId), isNotNull(recurringRules.deletedAt)))
      .all()
  },

  findByTrashBatchId(batchId: string): RecurringRule[] {
    return db.select().from(recurringRules).where(eq(recurringRules.trashBatchId, batchId)).all()
  },

  delete(id: string): void {
    db.delete(recurringRules).where(eq(recurringRules.id, id)).run()
  }
}
