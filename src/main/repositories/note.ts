import { eq, and, like } from 'drizzle-orm'
import { db } from '../db'
import { notes } from '../db/schema'
import { createFileRepository } from './create-file-repository'

export type Note = typeof notes.$inferSelect
export type NoteInsert = typeof notes.$inferInsert

const base = createFileRepository(notes, 'notes')

export const noteRepository = {
  ...base,
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
  searchByTitle(workspaceId: string, query: string): Note[] {
    const pattern = `%${query}%`
    return db
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, workspaceId), like(notes.title, pattern)))
      .all()
  }
}
