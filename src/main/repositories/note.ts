import { and, eq, inArray, not } from 'drizzle-orm'
import { db } from '../db'
import { notes } from '../db/schema'

export type Note = typeof notes.$inferSelect
export type NoteInsert = typeof notes.$inferInsert

export const noteRepository = {
  findByWorkspaceId(workspaceId: string): Note[] {
    return db.select().from(notes).where(eq(notes.workspaceId, workspaceId)).all()
  },

  findById(id: string): Note | undefined {
    return db.select().from(notes).where(eq(notes.id, id)).get()
  },

  findByRelativePath(workspaceId: string, relativePath: string): Note | undefined {
    return db
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, workspaceId), eq(notes.relativePath, relativePath)))
      .get()
  },

  create(data: NoteInsert): Note {
    return db.insert(notes).values(data).returning().get()
  },

  createMany(items: NoteInsert[]): void {
    if (items.length === 0) return
    db.insert(notes).values(items).onConflictDoNothing().run()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        Note,
        'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'
      >
    >
  ): Note | undefined {
    return db.update(notes).set(data).where(eq(notes.id, id)).returning().get()
  },

  /**
   * fs에 존재하지 않는 orphaned DB row 삭제
   * existingPaths가 빈 배열이면 해당 워크스페이스의 모든 note row 삭제
   */
  deleteOrphans(workspaceId: string, existingPaths: string[]): void {
    if (existingPaths.length === 0) {
      db.delete(notes).where(eq(notes.workspaceId, workspaceId)).run()
      return
    }
    db.delete(notes)
      .where(
        and(eq(notes.workspaceId, workspaceId), not(inArray(notes.relativePath, existingPaths)))
      )
      .run()
  },

  /**
   * 폴더 rename 시 해당 폴더 하위 note들의 relativePath를 일괄 업데이트
   * oldPrefix → newPrefix 로 prefix 교체
   */
  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
    const now = Date.now()
    db.$client.transaction(() => {
      db.$client
        .prepare(
          `UPDATE notes
           SET relative_path = ? || substr(relative_path, ?),
               updated_at = ?
           WHERE workspace_id = ?
             AND (relative_path = ? OR relative_path LIKE ?)`
        )
        .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
    })()
  },

  /**
   * siblings 전체 order 재할당 (integer reindex)
   * orderedIds: 원하는 순서로 정렬된 note id 배열
   */
  reindexSiblings(workspaceId: string, orderedIds: string[]): void {
    const now = Date.now()
    const stmt = db.$client.prepare(
      `UPDATE notes SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
    )
    db.$client.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        stmt.run(i, now, workspaceId, orderedIds[i])
      }
    })()
  },

  delete(id: string): void {
    db.delete(notes).where(eq(notes.id, id)).run()
  }
}
