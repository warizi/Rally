export interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
  createdBy?: 'user' | 'ai'
  createdById?: string | null
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
}
