export interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
}
