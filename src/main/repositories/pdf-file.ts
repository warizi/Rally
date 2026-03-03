import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '../db'
import { pdfFiles } from '../db/schema'

export type PdfFile = typeof pdfFiles.$inferSelect
export type PdfFileInsert = typeof pdfFiles.$inferInsert

export const pdfFileRepository = {
  findByWorkspaceId(workspaceId: string): PdfFile[] {
    return db.select().from(pdfFiles).where(eq(pdfFiles.workspaceId, workspaceId)).all()
  },

  findById(id: string): PdfFile | undefined {
    return db.select().from(pdfFiles).where(eq(pdfFiles.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): PdfFile | undefined {
    return db
      .select()
      .from(pdfFiles)
      .where(and(eq(pdfFiles.workspaceId, workspaceId), eq(pdfFiles.relativePath, relativePath)))
      .get()
  },

  create(data: PdfFileInsert): PdfFile {
    return db.insert(pdfFiles).values(data).returning().get()
  },

  createMany(items: PdfFileInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 99
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(pdfFiles)
        .values(items.slice(i, i + CHUNK))
        .onConflictDoNothing()
        .run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<
        PdfFile,
        'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'
      >
    >
  ): PdfFile | undefined {
    return db.update(pdfFiles).set(data).where(eq(pdfFiles.id, id)).returning().get()
  },

  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(pdfFiles).where(eq(pdfFiles.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: pdfFiles.id, relativePath: pdfFiles.relativePath })
      .from(pdfFiles)
      .where(eq(pdfFiles.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(pdfFiles)
        .where(inArray(pdfFiles.id, orphanIds.slice(i, i + CHUNK)))
        .run()
    }
  },

  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(pdfFiles)
      .where(and(eq(pdfFiles.workspaceId, workspaceId), like(pdfFiles.relativePath, `${prefix}/%`)))
      .run()
  },

  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE pdf_files
           SET relative_path = ? || substr(relative_path, ?),
               updated_at = ?
           WHERE workspace_id = ?
             AND (relative_path = ? OR relative_path LIKE ?)`
        )
        .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
    })()
  },

  reindexSiblings(workspaceId: string, orderedIds: string[]): void {
    const now = Date.now()
    const stmt = db.$client.prepare(
      `UPDATE pdf_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  findByIds(ids: string[]): PdfFile[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: PdfFile[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(...db.select().from(pdfFiles).where(inArray(pdfFiles.id, chunk)).all())
    }
    return results
  },

  delete(id: string): void {
    db.delete(pdfFiles).where(eq(pdfFiles.id, id)).run()
  }
}
