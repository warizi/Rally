import { and, eq, inArray, isNotNull, isNull, like, type InferSelectModel } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { db } from '../db'

/**
 * 파일 타입 repository 공통 메서드 팩토리
 * update()는 타입별 필드 차이(CSV의 columnWidths)가 있으므로 제외
 *
 * 모든 read는 휴지통 항목 제외 (`deletedAt IS NULL`).
 * deleteOrphans도 trashed row를 건드리지 않음 — 워크스페이스 외부 .trash 디렉토리로
 * 옮겨진 파일은 fs에 없지만 정상이라 watcher reconciler가 삭제하면 안 됨.
 */
export function createFileRepository<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends SQLiteTableWithColumns<any> & {
    id: SQLiteColumn
    workspaceId: SQLiteColumn
    relativePath: SQLiteColumn
    folderId: SQLiteColumn
    deletedAt: SQLiteColumn
    trashBatchId: SQLiteColumn
  }
>(
  table: T,
  tableName: string
): {
  findByWorkspaceId(workspaceId: string): InferSelectModel<T>[]
  findById(id: string): InferSelectModel<T> | undefined
  findByIdIncludingDeleted(id: string): InferSelectModel<T> | undefined
  findByRelativePath(workspaceId: string, relativePath: string): InferSelectModel<T> | undefined
  findByFolderId(workspaceId: string, folderId: string | null): InferSelectModel<T>[]
  create(data: T['$inferInsert']): InferSelectModel<T>
  createMany(items: T['$inferInsert'][]): void
  deleteOrphans(workspaceId: string, existingPaths: string[]): void
  bulkDeleteByPrefix(workspaceId: string, prefix: string): void
  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void
  reindexSiblings(workspaceId: string, orderedIds: string[]): void
  findByIds(ids: string[]): InferSelectModel<T>[]
  findInTrashByWorkspaceId(workspaceId: string): InferSelectModel<T>[]
  findByTrashBatchId(batchId: string): InferSelectModel<T>[]
  delete(id: string): void
} {
  type Row = InferSelectModel<T>
  type Insert = T['$inferInsert']

  const NOT_DELETED = isNull(table.deletedAt)

  return {
    findByWorkspaceId(workspaceId: string): Row[] {
      return db
        .select()
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), NOT_DELETED))
        .all() as Row[]
    },

    findById(id: string): Row | undefined {
      return db
        .select()
        .from(table)
        .where(and(eq(table.id, id), NOT_DELETED))
        .get() as Row | undefined
    },

    findByIdIncludingDeleted(id: string): Row | undefined {
      return db.select().from(table).where(eq(table.id, id)).get() as Row | undefined
    },

    findByRelativePath(workspaceId: string, relativePath: string): Row | undefined {
      return db
        .select()
        .from(table)
        .where(
          and(eq(table.workspaceId, workspaceId), eq(table.relativePath, relativePath), NOT_DELETED)
        )
        .get() as Row | undefined
    },

    findByFolderId(workspaceId: string, folderId: string | null): Row[] {
      if (folderId === null) {
        return db
          .select()
          .from(table)
          .where(and(eq(table.workspaceId, workspaceId), isNull(table.folderId), NOT_DELETED))
          .all() as Row[]
      }
      return db
        .select()
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), eq(table.folderId, folderId), NOT_DELETED))
        .all() as Row[]
    },

    create(data: Insert): Row {
      return db
        .insert(table)
        .values(data as T['$inferInsert'])
        .returning()
        .get() as Row
    },

    createMany(items: Insert[]): void {
      if (items.length === 0) return
      const CHUNK = 99
      for (let i = 0; i < items.length; i += CHUNK) {
        db.insert(table)
          .values(items.slice(i, i + CHUNK) as T['$inferInsert'][])
          .onConflictDoNothing()
          .run()
      }
    },

    /**
     * fs reconciler 용 — 활성 row 중 fs에 없는 것을 hard delete.
     * 휴지통 row(deletedAt NOT NULL)는 fs에 없어도 정상이므로 건드리지 않음.
     */
    deleteOrphans(workspaceId: string, existingPaths: string[]): void {
      const dbRows = db
        .select({ id: table.id, relativePath: table.relativePath })
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), NOT_DELETED))
        .all()
      if (existingPaths.length === 0) {
        // 활성 row 모두 hard delete (fs에 아무것도 없음 = 워크스페이스 비었음)
        const allIds = dbRows.map((r) => r.id as string)
        if (allIds.length === 0) return
        const CHUNK = 900
        for (let i = 0; i < allIds.length; i += CHUNK) {
          db.delete(table)
            .where(inArray(table.id, allIds.slice(i, i + CHUNK)))
            .run()
        }
        return
      }
      const existingSet = new Set(existingPaths)
      const orphanIds = dbRows
        .filter((r) => !existingSet.has(r.relativePath as string))
        .map((r) => r.id as string)
      if (orphanIds.length === 0) return
      const CHUNK = 900
      for (let i = 0; i < orphanIds.length; i += CHUNK) {
        db.delete(table)
          .where(inArray(table.id, orphanIds.slice(i, i + CHUNK)))
          .run()
      }
    },

    bulkDeleteByPrefix(workspaceId: string, prefix: string): void {
      db.delete(table)
        .where(and(eq(table.workspaceId, workspaceId), like(table.relativePath, `${prefix}/%`)))
        .run()
    },

    /**
     * 폴더 rename 시 활성 row의 relativePath만 업데이트.
     * 휴지통 row는 원래 위치 정보를 보존해야 복구 가능하므로 건드리지 않음.
     */
    bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
      const now = Date.now()
      db.$client.transaction(() => {
        db.$client
          .prepare(
            `UPDATE ${tableName}
             SET relative_path = ? || substr(relative_path, ?),
                 updated_at = ?
             WHERE workspace_id = ?
               AND deleted_at IS NULL
               AND (relative_path = ? OR relative_path LIKE ?)`
          )
          .run(newPrefix, oldPrefix.length + 1, now, workspaceId, oldPrefix, `${oldPrefix}/%`)
      })()
    },

    reindexSiblings(workspaceId: string, orderedIds: string[]): void {
      const now = Date.now()
      const stmt = db.$client.prepare(
        `UPDATE ${tableName} SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
      )
      db.$client.transaction(() => {
        for (let i = 0; i < orderedIds.length; i++) {
          stmt.run(i, now, workspaceId, orderedIds[i])
        }
      })()
    },

    findByIds(ids: string[]): Row[] {
      if (ids.length === 0) return []
      const CHUNK = 900
      const results: Row[] = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK)
        results.push(
          ...(db
            .select()
            .from(table)
            .where(and(inArray(table.id, chunk), NOT_DELETED))
            .all() as Row[])
        )
      }
      return results
    },

    findInTrashByWorkspaceId(workspaceId: string): Row[] {
      return db
        .select()
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), isNotNull(table.deletedAt)))
        .all() as Row[]
    },

    findByTrashBatchId(batchId: string): Row[] {
      return db.select().from(table).where(eq(table.trashBatchId, batchId)).all() as Row[]
    },

    delete(id: string): void {
      db.delete(table).where(eq(table.id, id)).run()
    }
  }
}
