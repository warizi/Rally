import { eq } from 'drizzle-orm'
import { db } from '../db'
import { imageFiles } from '../db/schema'
import { createFileRepository } from './create-file-repository'

export type ImageFile = typeof imageFiles.$inferSelect
export type ImageFileInsert = typeof imageFiles.$inferInsert

const base = createFileRepository(imageFiles, 'image_files')

export const imageFileRepository = {
  ...base,
  update(
    id: string,
    data: Partial<
      Pick<
        ImageFile,
        'relativePath' | 'title' | 'description' | 'preview' | 'folderId' | 'order' | 'updatedAt'
      >
    >
  ): ImageFile | undefined {
    return db.update(imageFiles).set(data).where(eq(imageFiles.id, id)).returning().get()
  }
}
