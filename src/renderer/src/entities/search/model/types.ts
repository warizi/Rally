export type SearchType = 'note' | 'table' | 'canvas' | 'todo' | 'pdf' | 'image'

export type SearchMode = 'semantic' | 'keyword' | 'hybrid'

export interface SearchHit {
  type: SearchType
  id: string
  title: string
  matchType: 'title' | 'content' | 'description'
  folderId: string | null
  folderPath: string | null
  updatedAt: string
  preview: string | null
  excerpt?: string
}
