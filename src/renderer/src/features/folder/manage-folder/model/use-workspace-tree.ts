import { useFolderTree } from '@entities/folder'
import type { FolderNode } from '@entities/folder'
import { useNotesByWorkspace } from '@entities/note'
import type { NoteNode } from '@entities/note'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import type { CsvFileNode } from '@entities/csv-file'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import type { PdfFileNode } from '@entities/pdf-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import type { ImageFileNode } from '@entities/image-file'
import type {
  WorkspaceTreeNode,
  FolderTreeNode,
  NoteTreeNode,
  CsvTreeNode,
  PdfTreeNode,
  ImageTreeNode
} from './types'

function getExtension(relativePath: string): string {
  const lastDot = relativePath.lastIndexOf('.')
  return lastDot === -1 ? '' : relativePath.slice(lastDot)
}

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
  csvFiles: CsvFileNode[],
  pdfFiles: PdfFileNode[],
  imageFiles: ImageFileNode[]
): WorkspaceTreeNode[] {
  function convertNote(note: NoteNode): NoteTreeNode {
    return {
      kind: 'note',
      id: note.id,
      name: note.title,
      relativePath: note.relativePath,
      extension: getExtension(note.relativePath),
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
      extension: getExtension(csv.relativePath),
      description: csv.description,
      preview: csv.preview,
      folderId: csv.folderId,
      order: csv.order
    }
  }

  function convertPdf(pdf: PdfFileNode): PdfTreeNode {
    return {
      kind: 'pdf',
      id: pdf.id,
      name: pdf.title,
      relativePath: pdf.relativePath,
      extension: getExtension(pdf.relativePath),
      description: pdf.description,
      preview: pdf.preview,
      folderId: pdf.folderId,
      order: pdf.order
    }
  }

  function convertImage(img: ImageFileNode): ImageTreeNode {
    return {
      kind: 'image',
      id: img.id,
      name: img.title,
      relativePath: img.relativePath,
      extension: getExtension(img.relativePath),
      description: img.description,
      preview: img.preview,
      folderId: img.folderId,
      order: img.order
    }
  }

  // leaf 항목(note + csv + pdf + image)을 order 기준으로 혼합 정렬.
  // 백엔드 `getLeafSiblings`(src/main/lib/leaf-reindex.ts)와 동일한 정렬 규칙을 사용해야
  // DnD 순서 변경 시 frontend가 보내는 index가 backend siblings의 같은 위치를 가리킨다.
  // - 종류 input 순서: notes, csvs, pdfs, images (백엔드와 동일)
  // - 정렬 키: order만(stable). 이름 tiebreaker를 쓰면 백엔드와 어긋나 multi-kind 폴더에서
  //   순서 변경이 잘못된 자리로 가버리는 버그가 발생한다.
  function getLeafChildren(folderId: string | null): WorkspaceTreeNode[] {
    const childNotes = notes.filter((n) => n.folderId === folderId).map(convertNote)
    const childCsvs = csvFiles.filter((c) => c.folderId === folderId).map(convertCsv)
    const childPdfs = pdfFiles.filter((p) => p.folderId === folderId).map(convertPdf)
    const childImages = imageFiles.filter((i) => i.folderId === folderId).map(convertImage)
    return [...childNotes, ...childCsvs, ...childPdfs, ...childImages].sort(
      (a, b) => a.order - b.order
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
  const { data: pdfFiles = [], isLoading: isPdfsLoading } = usePdfFilesByWorkspace(workspaceId)
  const { data: imageFiles = [], isLoading: isImagesLoading } =
    useImageFilesByWorkspace(workspaceId)

  const tree = buildWorkspaceTree(folders, notes, csvFiles, pdfFiles, imageFiles)

  return {
    tree,
    isLoading:
      isFoldersLoading || isNotesLoading || isCsvsLoading || isPdfsLoading || isImagesLoading
  }
}
