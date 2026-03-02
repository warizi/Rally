import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '../db'
import { imageFiles } from '../db/schema'

export type ImageFile = typeof imageFiles.$inferSelect
export type ImageFileInsert = typeof imageFiles.$inferInsert

export const imageFileRepository = {
  findByWorkspaceId(workspaceId: string): ImageFile[] {
    return db.select().from(imageFiles).where(eq(imageFiles.workspaceId, workspaceId)).all()
  },

  findById(id: string): ImageFile | undefined {
    return db.select().from(imageFiles).where(eq(imageFiles.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): ImageFile | undefined {
    return db
      .select()
      .from(imageFiles)
      .where(and(eq(imageFiles.workspaceId, workspaceId), eq(imageFiles.relativePath, relativePath)))
      .get()
  },

  create(data: ImageFileInsert): ImageFile {
    return db.insert(imageFiles).values(data).returning().get()
  },

  createMany(items: ImageFileInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 99
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(imageFiles).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<ImageFile, 'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'>
    >
  ): ImageFile | undefined {
    return db.update(imageFiles).set(data).where(eq(imageFiles.id, id)).returning().get()
  },

  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(imageFiles).where(eq(imageFiles.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: imageFiles.id, relativePath: imageFiles.relativePath })
      .from(imageFiles)
      .where(eq(imageFiles.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(imageFiles).where(inArray(imageFiles.id, orphanIds.slice(i, i + CHUNK))).run()
    }
  },

  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(imageFiles)
      .where(and(eq(imageFiles.workspaceId, workspaceId), like(imageFiles.relativePath, `${prefix}/%`)))
      .run()
  },

  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE image_files
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
      `UPDATE image_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(imageFiles).where(eq(imageFiles.id, id)).run()
  }
}
