import { and, eq, like, or } from 'drizzle-orm'
import { db } from '../db'
import { csvFiles } from '../db/schema'
import { createFileRepository } from './create-file-repository'

export type CsvFile = typeof csvFiles.$inferSelect
export type CsvFileInsert = typeof csvFiles.$inferInsert

const base = createFileRepository(csvFiles, 'csv_files')

export const csvFileRepository = {
  ...base,
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

  /** 제목/설명/preview LIKE 검색. preview 컬럼은 본문 일부 캐시이므로 본문 검색 근사치. */
  searchByTitleOrText(workspaceId: string, query: string): CsvFile[] {
    const pattern = `%${query}%`
    return db
      .select()
      .from(csvFiles)
      .where(
        and(
          eq(csvFiles.workspaceId, workspaceId),
          or(
            like(csvFiles.title, pattern),
            like(csvFiles.description, pattern),
            like(csvFiles.preview, pattern)
          )!
        )
      )
      .all()
  }
}
