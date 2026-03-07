import { eq } from 'drizzle-orm'
import { db } from '../db'
import { pdfFiles } from '../db/schema'
import { createFileRepository } from './create-file-repository'

export type PdfFile = typeof pdfFiles.$inferSelect
export type PdfFileInsert = typeof pdfFiles.$inferInsert

const base = createFileRepository(pdfFiles, 'pdf_files')

export const pdfFileRepository = {
  ...base,
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
  }
}
