import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { templates } from '../db/schema'

export type Template = typeof templates.$inferSelect
export type TemplateInsert = typeof templates.$inferInsert
export type TemplateType = 'note' | 'csv'

export const templateRepository = {
  findByWorkspaceAndType(workspaceId: string, type: TemplateType): Template[] {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.workspaceId, workspaceId), eq(templates.type, type)))
      .orderBy(asc(templates.title))
      .all()
  },

  findByWorkspace(workspaceId: string): Template[] {
    return db
      .select()
      .from(templates)
      .where(eq(templates.workspaceId, workspaceId))
      .orderBy(asc(templates.type), asc(templates.title))
      .all()
  },

  findById(id: string): Template | undefined {
    return db.select().from(templates).where(eq(templates.id, id)).get()
  },

  create(data: TemplateInsert): Template {
    return db.insert(templates).values(data).returning().get()
  },

  delete(id: string): void {
    db.delete(templates).where(eq(templates.id, id)).run()
  }
}
