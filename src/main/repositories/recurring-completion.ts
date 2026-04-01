import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { recurringCompletions } from '../db/schema'

export type RecurringCompletion = typeof recurringCompletions.$inferSelect
export type RecurringCompletionInsert = typeof recurringCompletions.$inferInsert

export const recurringCompletionRepository = {
  findByRuleAndDate(ruleId: string, completedDate: string): RecurringCompletion | undefined {
    return db
      .select()
      .from(recurringCompletions)
      .where(
        and(
          eq(recurringCompletions.ruleId, ruleId),
          eq(recurringCompletions.completedDate, completedDate)
        )
      )
      .get()
  },

  findByWorkspaceAndDate(workspaceId: string, completedDate: string): RecurringCompletion[] {
    return db
      .select()
      .from(recurringCompletions)
      .where(
        and(
          eq(recurringCompletions.workspaceId, workspaceId),
          eq(recurringCompletions.completedDate, completedDate)
        )
      )
      .all()
  },

  findAllByWorkspace(workspaceId: string): RecurringCompletion[] {
    return db
      .select()
      .from(recurringCompletions)
      .where(eq(recurringCompletions.workspaceId, workspaceId))
      .all()
  },

  findById(id: string): RecurringCompletion | undefined {
    return db.select().from(recurringCompletions).where(eq(recurringCompletions.id, id)).get()
  },

  create(data: RecurringCompletionInsert): RecurringCompletion {
    return db.insert(recurringCompletions).values(data).returning().get()
  },

  delete(id: string): void {
    db.delete(recurringCompletions).where(eq(recurringCompletions.id, id)).run()
  },

  deleteByRuleId(ruleId: string): void {
    db.delete(recurringCompletions).where(eq(recurringCompletions.ruleId, ruleId)).run()
  },

  // ruleId가 null인 고아 이력 조회 (규칙 삭제된 이력)
  findOrphansByWorkspace(workspaceId: string): RecurringCompletion[] {
    return db
      .select()
      .from(recurringCompletions)
      .where(
        and(eq(recurringCompletions.workspaceId, workspaceId), isNull(recurringCompletions.ruleId))
      )
      .all()
  }
}
