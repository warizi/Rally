export interface CsvFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  columnWidths: string | null
  folderId: string | null
  order: number
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
}
