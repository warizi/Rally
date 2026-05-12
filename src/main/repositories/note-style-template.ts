import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { noteStyleTemplates } from '../db/schema'

export type NoteStyleTemplate = typeof noteStyleTemplates.$inferSelect
export type NoteStyleTemplateInsert = typeof noteStyleTemplates.$inferInsert

export const noteStyleTemplateRepository = {
  findAll(): NoteStyleTemplate[] {
    return db.select().from(noteStyleTemplates).orderBy(desc(noteStyleTemplates.createdAt)).all()
  },

  findById(id: string): NoteStyleTemplate | undefined {
    return db.select().from(noteStyleTemplates).where(eq(noteStyleTemplates.id, id)).get()
  },

  create(data: NoteStyleTemplateInsert): NoteStyleTemplate {
    return db.insert(noteStyleTemplates).values(data).returning().get()
  },

  delete(id: string): void {
    db.delete(noteStyleTemplates).where(eq(noteStyleTemplates.id, id)).run()
  }
}
