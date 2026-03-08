import { and, eq, inArray, isNull, like, type InferSelectModel } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { db } from '../db'

/**
 * 파일 타입 repository 공통 메서드 팩토리
 * update()는 타입별 필드 차이(CSV의 columnWidths)가 있으므로 제외
 */
export function createFileRepository<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends SQLiteTableWithColumns<any> & {
    id: SQLiteColumn
    workspaceId: SQLiteColumn
    relativePath: SQLiteColumn
    folderId: SQLiteColumn
  }
>(
  table: T,
  tableName: string
): {
  findByWorkspaceId(workspaceId: string): InferSelectModel<T>[]
  findById(id: string): InferSelectModel<T> | undefined
  findByRelativePath(workspaceId: string, relativePath: string): InferSelectModel<T> | undefined
  findByFolderId(workspaceId: string, folderId: string | null): InferSelectModel<T>[]
  create(data: T['$inferInsert']): InferSelectModel<T>
  createMany(items: T['$inferInsert'][]): void
  deleteOrphans(workspaceId: string, existingPaths: string[]): void
  bulkDeleteByPrefix(workspaceId: string, prefix: string): void
  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void
  reindexSiblings(workspaceId: string, orderedIds: string[]): void
  findByIds(ids: string[]): InferSelectModel<T>[]
  delete(id: string): void
} {
  type Row = InferSelectModel<T>
  type Insert = T['$inferInsert']

  return {
    findByWorkspaceId(workspaceId: string): Row[] {
      return db.select().from(table).where(eq(table.workspaceId, workspaceId)).all() as Row[]
    },

    findById(id: string): Row | undefined {
      return db.select().from(table).where(eq(table.id, id)).get() as Row | undefined
    },

    findByRelativePath(workspaceId: string, relativePath: string): Row | undefined {
      return db
        .select()
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), eq(table.relativePath, relativePath)))
        .get() as Row | undefined
    },

    findByFolderId(workspaceId: string, folderId: string | null): Row[] {
      if (folderId === null) {
        return db
          .select()
          .from(table)
          .where(and(eq(table.workspaceId, workspaceId), isNull(table.folderId)))
          .all() as Row[]
      }
      return db
        .select()
        .from(table)
        .where(and(eq(table.workspaceId, workspaceId), eq(table.folderId, folderId)))
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

    deleteOrphans(workspaceId: string, existingPaths: string[]): void {
      if (existingPaths.length === 0) {
        db.delete(table).where(eq(table.workspaceId, workspaceId)).run()
        return
      }
      const existingSet = new Set(existingPaths)
      const dbRows = db
        .select({ id: table.id, relativePath: table.relativePath })
        .from(table)
        .where(eq(table.workspaceId, workspaceId))
        .all()
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

    bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void {
      const now = Date.now()
      db.$client.transaction(() => {
        db.$client
          .prepare(
            `UPDATE ${tableName}
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
        results.push(...(db.select().from(table).where(inArray(table.id, chunk)).all() as Row[]))
      }
      return results
    },

    delete(id: string): void {
      db.delete(table).where(eq(table.id, id)).run()
    }
  }
}
