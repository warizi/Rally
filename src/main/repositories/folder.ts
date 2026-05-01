import { and, eq, inArray, isNotNull, isNull, like, or } from 'drizzle-orm'
import { db } from '../db'
import { folders } from '../db/schema'

export type Folder = typeof folders.$inferSelect
export type FolderInsert = typeof folders.$inferInsert

const NOT_DELETED = isNull(folders.deletedAt)

export const folderRepository = {
  findByWorkspaceId(workspaceId: string): Folder[] {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.workspaceId, workspaceId), NOT_DELETED))
      .all()
  },

  findById(id: string): Folder | undefined {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), NOT_DELETED))
      .get()
  },

  findByIdIncludingDeleted(id: string): Folder | undefined {
    return db.select().from(folders).where(eq(folders.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): Folder | undefined {
    return db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.workspaceId, workspaceId),
          eq(folders.relativePath, relativePath),
          NOT_DELETED
        )
      )
      .get()
  },

  create(data: FolderInsert): Folder {
    return db.insert(folders).values(data).returning().get()
  },

  createMany(items: FolderInsert[]): void {
    if (items.length === 0) return
    const CHUNK = 100
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(folders)
        .values(items.slice(i, i + CHUNK))
        .onConflictDoNothing()
        .run()
    }
  },

  update(
    id: string,
    data: Partial<
      Pick<Folder, 'relativePath' | 'color' | 'order' | 'updatedAt' | 'deletedAt' | 'trashBatchId'>
    >
  ): Folder | undefined {
    return db.update(folders).set(data).where(eq(folders.id, id)).returning().get()
  },

  /**
   * 폴더 rename 시 해당 폴더 + 활성 하위 폴더의 relativePath를 일괄 업데이트.
   * 휴지통 row는 원래 위치 보존(복구를 위해).
   */
  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE folders
           SET relative_path = ? || substr(relative_path, ?),
               updated_at = ?
           WHERE workspace_id = ?
             AND deleted_at IS NULL
             AND (relative_path = ? OR relative_path LIKE ?)`
        )
        .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
    })()
  },

  /**
   * 폴더 삭제 시 해당 폴더 + 모든 하위 폴더 DB row 일괄 삭제.
   * (영구 삭제 경로 — 휴지통 cascade는 trashService가 별도 처리)
   */
  bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
    db.delete(folders)
      .where(
        and(
          eq(folders.workspaceId, workspaceId),
          or(eq(folders.relativePath, prefix), like(folders.relativePath, `${prefix}/%`))
        )
      )
      .run()
  },

  /**
   * fs에 존재하지 않는 orphaned 활성 row 삭제.
   * 휴지통 row는 fs 외부 .trash 디렉토리에 있으므로 건드리지 않음.
   */
  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    const dbRows = db
      .select({ id: folders.id, relativePath: folders.relativePath })
      .from(folders)
      .where(and(eq(folders.workspaceId, workspaceId), NOT_DELETED))
      .all()
    if (existingPaths.length === 0) {
      const allIds = dbRows.map((r) => r.id)
      if (allIds.length === 0) return
      const CHUNK = 900
      for (let i = 0; i < allIds.length; i += CHUNK) {
        db.delete(folders)
          .where(inArray(folders.id, allIds.slice(i, i + CHUNK)))
          .run()
      }
      return
    }
    const existingSet = new Set(existingPaths)
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(folders)
        .where(inArray(folders.id, orphanIds.slice(i, i + CHUNK)))
        .run()
    }
  },

  reindexSiblings(workspaceId: string, orderedIds: string[]): void {
    const now = Date.now()
    const stmt = db.$client.prepare(
      `UPDATE folders SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  findInTrashByWorkspaceId(workspaceId: string): Folder[] {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.workspaceId, workspaceId), isNotNull(folders.deletedAt)))
      .all()
  },

  findByTrashBatchId(batchId: string): Folder[] {
    return db.select().from(folders).where(eq(folders.trashBatchId, batchId)).all()
  },

  delete(id: string): void {
    db.delete(folders).where(eq(folders.id, id)).run()
  }
}
