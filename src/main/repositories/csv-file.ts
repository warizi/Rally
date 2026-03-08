import { eq } from 'drizzle-orm'
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
  }
}
