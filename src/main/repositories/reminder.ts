import { and, eq, lte, inArray } from 'drizzle-orm'
import { db } from '../db'
import { reminders } from '../db/schema'

export type Reminder = typeof reminders.$inferSelect
export type ReminderInsert = typeof reminders.$inferInsert

export const reminderRepository = {
  findByEntity(entityType: 'todo' | 'schedule', entityId: string): Reminder[] {
    return db
      .select()
      .from(reminders)
      .where(and(eq(reminders.entityType, entityType), eq(reminders.entityId, entityId)))
      .all()
  },

  findPending(now: Date): Reminder[] {
    return db
      .select()
      .from(reminders)
      .where(and(lte(reminders.remindAt, now), eq(reminders.isFired, false)))
      .all()
  },

  findById(id: string): Reminder | undefined {
    return db.select().from(reminders).where(eq(reminders.id, id)).get()
  },

  create(data: ReminderInsert): Reminder {
    return db.insert(reminders).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<Reminder, 'remindAt' | 'isFired' | 'updatedAt'>>
  ): Reminder | undefined {
    return db.update(reminders).set(data).where(eq(reminders.id, id)).returning().get()
  },

  markFired(id: string, now: Date): void {
    db.update(reminders)
      .set({ isFired: true, updatedAt: now })
      .where(eq(reminders.id, id))
      .run()
  },

  delete(id: string): void {
    db.delete(reminders).where(eq(reminders.id, id)).run()
  },

  deleteByEntity(entityType: 'todo' | 'schedule', entityId: string): void {
    db.delete(reminders)
      .where(and(eq(reminders.entityType, entityType), eq(reminders.entityId, entityId)))
      .run()
  },

  deleteByEntities(entityType: 'todo' | 'schedule', entityIds: string[]): void {
    if (entityIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < entityIds.length; i += CHUNK) {
      const chunk = entityIds.slice(i, i + CHUNK)
      db.delete(reminders)
        .where(and(eq(reminders.entityType, entityType), inArray(reminders.entityId, chunk)))
        .run()
    }
  },

  deleteUnfiredByEntity(entityType: 'todo' | 'schedule', entityId: string): void {
    db.delete(reminders)
      .where(
        and(
          eq(reminders.entityType, entityType),
          eq(reminders.entityId, entityId),
          eq(reminders.isFired, false)
        )
      )
      .run()
  }
}
