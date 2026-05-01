import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db'
import { templates } from '../db/schema'

export type Template = typeof templates.$inferSelect
export type TemplateInsert = typeof templates.$inferInsert
export type TemplateType = 'note' | 'csv'

const NOT_DELETED = isNull(templates.deletedAt)

export const templateRepository = {
  findByWorkspaceAndType(workspaceId: string, type: TemplateType): Template[] {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.workspaceId, workspaceId), eq(templates.type, type), NOT_DELETED))
      .orderBy(asc(templates.title))
      .all()
  },

  findByWorkspace(workspaceId: string): Template[] {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.workspaceId, workspaceId), NOT_DELETED))
      .orderBy(asc(templates.type), asc(templates.title))
      .all()
  },

  findById(id: string): Template | undefined {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), NOT_DELETED))
      .get()
  },

  findByIdIncludingDeleted(id: string): Template | undefined {
    return db.select().from(templates).where(eq(templates.id, id)).get()
  },

  create(data: TemplateInsert): Template {
    return db.insert(templates).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<Template, 'deletedAt' | 'trashBatchId'>>
  ): Template | undefined {
    return db.update(templates).set(data).where(eq(templates.id, id)).returning().get()
  },

  findInTrashByWorkspaceId(workspaceId: string): Template[] {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.workspaceId, workspaceId), isNotNull(templates.deletedAt)))
      .all()
  },

  findByTrashBatchId(batchId: string): Template[] {
    return db.select().from(templates).where(eq(templates.trashBatchId, batchId)).all()
  },

  delete(id: string): void {
    db.delete(templates).where(eq(templates.id, id)).run()
  }
}
