export interface FolderTreeNode {
  kind: 'folder'
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: WorkspaceTreeNode[] // 하위 폴더 + 노트 혼합
}

export interface NoteTreeNode {
  kind: 'note'
  id: string
  name: string // NoteNode.title에서 매핑
  relativePath: string
  extension: string // relativePath에서 추출 (예: '.md')
  description: string
  preview: string
  folderId: string | null
  order: number
}

export interface CsvTreeNode {
  kind: 'csv'
  id: string
  name: string // CsvFileNode.title에서 매핑
  relativePath: string
  extension: string // '.csv'
  description: string
  preview: string
  folderId: string | null
  order: number
}

export interface PdfTreeNode {
  kind: 'pdf'
  id: string
  name: string // PdfFileNode.title에서 매핑
  relativePath: string
  extension: string // '.pdf'
  description: string
  preview: string
  folderId: string | null
  order: number
}

export interface ImageTreeNode {
  kind: 'image'
  id: string
  name: string
  relativePath: string
  extension: string // '.png' | '.jpg' | ... (relativePath에서 동적 추출)
  description: string
  preview: string
  folderId: string | null
  order: number
}

export type WorkspaceTreeNode =
  | FolderTreeNode
  | NoteTreeNode
  | CsvTreeNode
  | PdfTreeNode
  | ImageTreeNode
