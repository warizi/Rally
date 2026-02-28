import { and, eq, inArray, like, or } from 'drizzle-orm'
import { db } from '../db'
import { folders } from '../db/schema'

export type Folder = typeof folders.$inferSelect
export type FolderInsert = typeof folders.$inferInsert

export const folderRepository = {
  findByWorkspaceId(workspaceId: string): Folder[] {
    return db.select().from(folders).where(eq(folders.workspaceId, workspaceId)).all()
  },

  findById(id: string): Folder | undefined {
    return db.select().from(folders).where(eq(folders.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): Folder | undefined {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.workspaceId, workspaceId), eq(folders.relativePath, relativePath)))
      .get()
  },

  create(data: FolderInsert): Folder {
    return db.insert(folders).values(data).returning().get()
  },

  createMany(items: FolderInsert[]): void {
    if (items.length === 0) return
    // SQLite bind parameter limit: 999. folders has 7 columns → max 142 rows per statement.
    // Chunk at 100 rows to stay well under the limit.
    const CHUNK = 100
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(folders).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  },

  update(
    id: string,
    data: Partial<Pick<Folder, 'relativePath' | 'color' | 'order' | 'updatedAt'>>
  ): Folder | undefined {
    return db.update(folders).set(data).where(eq(folders.id, id)).returning().get()
  },

  /**
   * 폴더 rename 시 해당 폴더 + 모든 하위 폴더의 relativePath를 일괄 업데이트
   * oldPrefix → newPrefix 로 prefix 교체 (SQLite raw query 사용)
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
             AND (relative_path = ? OR relative_path LIKE ?)`
        )
        .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
    })()
  },

  /**
   * 폴더 삭제 시 해당 폴더 + 모든 하위 폴더 DB row 일괄 삭제
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
   * fs에 존재하지 않는 orphaned DB row 삭제
   * existingPaths 가 빈 배열인 경우 = 워크스페이스에 폴더가 전혀 없음
   *   → 해당 워크스페이스의 모든 folder row 삭제 (의도적 all-delete)
   *   → 서비스 레이어에서 미리 accessSync 체크 후 ValidationError를 던지므로 안전
   *
   * NOT IN (huge list) 대신 JS-side diff → id 배치 DELETE 로 SQLite 변수 한도 우회
   */
  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(folders).where(eq(folders.workspaceId, workspaceId)).run()
      return
    }
    const existingSet = new Set(existingPaths)
    const dbRows = db
      .select({ id: folders.id, relativePath: folders.relativePath })
      .from(folders)
      .where(eq(folders.workspaceId, workspaceId))
      .all()
    const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
    if (orphanIds.length === 0) return
    // inArray also has the 999-variable limit; chunk at 900 to stay safe
    const CHUNK = 900
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      db.delete(folders).where(inArray(folders.id, orphanIds.slice(i, i + CHUNK))).run()
    }
  },

  /**
   * siblings 전체 order 재할당 (integer reindex)
   * orderedIds: 원하는 순서로 정렬된 folder id 배열
   * db.$client.transaction + raw SQL — bulkUpdatePathPrefix와 동일 패턴
   */
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

  delete(id: string): void {
    db.delete(folders).where(eq(folders.id, id)).run()
  }
}
