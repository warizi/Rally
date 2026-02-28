import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '../db'
import { csvFiles } from '../db/schema'

export type CsvFile = typeof csvFiles.$inferSelect
export type CsvFileInsert = typeof csvFiles.$inferInsert

export const csvFileRepository = {
  findByWorkspaceId(workspaceId: string): CsvFile[] {
    return db.select().from(csvFiles).where(eq(csvFiles.workspaceId, workspaceId)).all()
  },

  findById(id: string): CsvFile | undefined {
    return db.select().from(csvFiles).where(eq(csvFiles.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): CsvFile | undefined {
    return db
      .select()
      .from(csvFiles)
      .where(and(eq(csvFiles.workspaceId, workspaceId), eq(csvFiles.relativePath, relativePath)))
      .get()
  },

  create(data: CsvFileInsert): CsvFile {
    return db.insert(csvFiles).values(data).returning().get()
  },

  createMany(items: CsvFileInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 99 // 10 columns × 99 = 990 < SQLite 999 limit
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(csvFiles).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<
        CsvFile,
        | 'relativePath'
        | 'title'
        | 'description'
        | 'preview'
        | 'columnWidths'
        | 'folderId'
        | 'order'
        | 'updatedAt'
      >
    >
  ): CsvFile | undefined {
    return db.update(csvFiles).set(data).where(eq(csvFiles.id, id)).returning().get()
  },

  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(csvFiles).where(eq(csvFiles.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: csvFiles.id, relativePath: csvFiles.relativePath })
      .from(csvFiles)
      .where(eq(csvFiles.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(csvFiles).where(inArray(csvFiles.id, orphanIds.slice(i, i + CHUNK))).run()
    }
  },

  /**
   * 폴더 삭제 시 해당 폴더 하위 csv 파일들을 일괄 삭제
   */
  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(csvFiles)
      .where(and(eq(csvFiles.workspaceId, workspaceId), like(csvFiles.relativePath, `${prefix}/%`)))
      .run()
  },

  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE csv_files
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
      `UPDATE csv_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(csvFiles).where(eq(csvFiles.id, id)).run()
  }
}
