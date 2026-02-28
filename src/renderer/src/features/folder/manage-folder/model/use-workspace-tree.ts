import { useFolderTree } from '@entities/folder'
import type { FolderNode } from '@entities/folder'
import { useNotesByWorkspace } from '@entities/note'
import type { NoteNode } from '@entities/note'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import type { CsvFileNode } from '@entities/csv-file'
import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode, CsvTreeNode } from './types'

/**
 * FolderNode[] + NoteNode[] → WorkspaceTreeNode[] 병합
 *
 * 변환 규칙:
 * - useFolderTree는 이미 nested tree (children 포함)를 반환함 → children을 그대로 활용
 * - NoteNode.title → NoteTreeNode.name (필드명 매핑 주의)
 * - 각 폴더의 children 끝에 해당 folder.id의 notes를 추가 (order 기준 정렬)
 * - folderId=null인 루트 노트는 루트 레벨 맨 끝에 추가
 */
export function buildWorkspaceTree(
  folders: FolderNode[], // useFolderTree가 반환하는 nested tree (root 폴더만 top-level)
  notes: NoteNode[],
  csvFiles: CsvFileNode[]
): WorkspaceTreeNode[] {
  function convertNote(note: NoteNode): NoteTreeNode {
    return {
      kind: 'note',
      id: note.id,
      name: note.title,
      relativePath: note.relativePath,
      description: note.description,
      preview: note.preview,
      folderId: note.folderId,
      order: note.order
    }
  }

  function convertCsv(csv: CsvFileNode): CsvTreeNode {
    return {
      kind: 'csv',
      id: csv.id,
      name: csv.title,
      relativePath: csv.relativePath,
      description: csv.description,
      preview: csv.preview,
      folderId: csv.folderId,
      order: csv.order
    }
  }

  // leaf 항목(note + csv)을 order 기준으로 혼합 정렬
  function getLeafChildren(folderId: string | null): WorkspaceTreeNode[] {
    const childNotes = notes
      .filter((n) => n.folderId === folderId)
      .map(convertNote)
    const childCsvs = csvFiles
      .filter((c) => c.folderId === folderId)
      .map(convertCsv)
    return [...childNotes, ...childCsvs].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name)
    )
  }

  // FolderNode.children은 folderService.readTree가 이미 구성 → 그대로 재귀 변환
  function convertFolder(folder: FolderNode): FolderTreeNode {
    const childFolders = folder.children
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(convertFolder)

    return {
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      relativePath: folder.relativePath,
      color: folder.color,
      order: folder.order,
      children: [...childFolders, ...getLeafChildren(folder.id)]
    }
  }

  const rootFolders = folders
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(convertFolder)

  return [...rootFolders, ...getLeafChildren(null)]
}

export function useWorkspaceTree(workspaceId: string): {
  tree: WorkspaceTreeNode[]
  isLoading: boolean
} {
  const { data: folders = [], isLoading: isFoldersLoading } = useFolderTree(workspaceId)
  const { data: notes = [], isLoading: isNotesLoading } = useNotesByWorkspace(workspaceId)
  const { data: csvFiles = [], isLoading: isCsvsLoading } = useCsvFilesByWorkspace(workspaceId)

  const tree = buildWorkspaceTree(folders, notes, csvFiles)

  return {
    tree,
    isLoading: isFoldersLoading || isNotesLoading || isCsvsLoading
  }
}
