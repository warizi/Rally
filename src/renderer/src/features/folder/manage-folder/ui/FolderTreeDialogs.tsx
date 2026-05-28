import type { JSX } from 'react'
import { useTabStore } from '@/entities/tab-system'
import { FolderColorDialog } from './FolderColorDialog'
import { FolderNameDialog } from './FolderNameDialog'
import { DeleteFolderDialog } from './DeleteFolderDialog'
import type { FolderDialogState } from '../model/use-folder-dialog-state'
import type { WorkspaceTreeNode } from '../model/types'
import { collectDescendantPathnames, findFolderNode } from '../model/folder-tree-helpers'

interface Mutations {
  createFolder: (
    args: { workspaceId: string; parentFolderId: string | null; name: string },
    options: { onSuccess: () => void }
  ) => void
  isCreatingFolder: boolean
  rename: (
    args: { workspaceId: string; folderId: string; newName: string },
    options: { onSuccess: () => void }
  ) => void
  isRenaming: boolean
  updateMeta: (
    args: { workspaceId: string; folderId: string; data: { color: string | null } },
    options: { onSuccess: () => void }
  ) => void
  isUpdatingMeta: boolean
  remove: (
    args: { workspaceId: string; folderId: string },
    options: { onSuccess: () => void }
  ) => void
  isRemoving: boolean
  removeNote: (
    args: { workspaceId: string; noteId: string },
    options: { onSuccess: () => void }
  ) => void
  isRemovingNote: boolean
  removeCsvFile: (
    args: { workspaceId: string; csvId: string },
    options: { onSuccess: () => void }
  ) => void
  isRemovingCsv: boolean
  removePdfFile: (
    args: { workspaceId: string; pdfId: string },
    options: { onSuccess: () => void }
  ) => void
  isRemovingPdf: boolean
  removeImageFile: (
    args: { workspaceId: string; imageId: string },
    options: { onSuccess: () => void }
  ) => void
  isRemovingImage: boolean
}

interface Props {
  workspaceId: string
  tree: WorkspaceTreeNode[]
  dialogState: FolderDialogState
  mutations: Mutations
}

/**
 * FolderTree 의 8개 dialog (Folder create/rename/color/delete + File delete × 4)
 * 를 묶은 컴포넌트.
 *
 * Props 로 받은 dialogState (target + setter 쌍) 를 dialog open/close 신호로 사용.
 * mutation 호출 후 setter(null) 로 닫음.
 */
export function FolderTreeDialogs({
  workspaceId,
  tree,
  dialogState,
  mutations
}: Props): JSX.Element {
  const {
    createTarget,
    setCreateTarget,
    renameTarget,
    setRenameTarget,
    colorTarget,
    setColorTarget,
    deleteTarget,
    setDeleteTarget,
    noteDeleteTarget,
    setNoteDeleteTarget,
    csvDeleteTarget,
    setCsvDeleteTarget,
    pdfDeleteTarget,
    setPdfDeleteTarget,
    imageDeleteTarget,
    setImageDeleteTarget
  } = dialogState

  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)

  return (
    <>
      {/* 폴더 생성 */}
      <FolderNameDialog
        open={createTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCreateTarget(null)
        }}
        title="폴더 생성"
        defaultValue=""
        submitLabel="생성"
        isPending={mutations.isCreatingFolder}
        onSubmit={(name) => {
          if (createTarget) {
            mutations.createFolder(
              { workspaceId, parentFolderId: createTarget.parentFolderId, name },
              { onSuccess: () => setCreateTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 이름 변경 */}
      <FolderNameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        title="이름 변경"
        defaultValue={renameTarget?.name ?? ''}
        submitLabel="변경"
        isPending={mutations.isRenaming}
        onSubmit={(name) => {
          if (renameTarget) {
            mutations.rename(
              { workspaceId, folderId: renameTarget.id, newName: name },
              { onSuccess: () => setRenameTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 색상 */}
      <FolderColorDialog
        open={colorTarget !== null}
        onOpenChange={(open) => {
          if (!open) setColorTarget(null)
        }}
        currentColor={colorTarget?.color ?? null}
        isPending={mutations.isUpdatingMeta}
        onSubmit={(color) => {
          if (colorTarget) {
            mutations.updateMeta(
              { workspaceId, folderId: colorTarget.id, data: { color } },
              { onSuccess: () => setColorTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 삭제 (자손 탭 닫기 포함) */}
      <DeleteFolderDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        folderName={deleteTarget?.name ?? ''}
        isPending={mutations.isRemoving}
        onConfirm={() => {
          if (deleteTarget) {
            const folder = findFolderNode(tree, deleteTarget.id)
            const childPathnames = folder ? collectDescendantPathnames(folder.children) : []
            mutations.remove(
              { workspaceId, folderId: deleteTarget.id },
              {
                onSuccess: () => {
                  childPathnames.forEach((p) => closeTabByPathname(p))
                  setDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* 노트 삭제 */}
      <DeleteFolderDialog
        open={noteDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNoteDeleteTarget(null)
        }}
        folderName={noteDeleteTarget?.name ?? ''}
        isPending={mutations.isRemovingNote}
        onConfirm={() => {
          if (noteDeleteTarget) {
            mutations.removeNote(
              { workspaceId, noteId: noteDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/note/${noteDeleteTarget.id}`)
                  setNoteDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* CSV 삭제 */}
      <DeleteFolderDialog
        open={csvDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCsvDeleteTarget(null)
        }}
        folderName={csvDeleteTarget?.name ?? ''}
        isPending={mutations.isRemovingCsv}
        onConfirm={() => {
          if (csvDeleteTarget) {
            mutations.removeCsvFile(
              { workspaceId, csvId: csvDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/csv/${csvDeleteTarget.id}`)
                  setCsvDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* PDF 삭제 */}
      <DeleteFolderDialog
        open={pdfDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPdfDeleteTarget(null)
        }}
        folderName={pdfDeleteTarget?.name ?? ''}
        isPending={mutations.isRemovingPdf}
        onConfirm={() => {
          if (pdfDeleteTarget) {
            mutations.removePdfFile(
              { workspaceId, pdfId: pdfDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/pdf/${pdfDeleteTarget.id}`)
                  setPdfDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* Image 삭제 */}
      <DeleteFolderDialog
        open={imageDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setImageDeleteTarget(null)
        }}
        folderName={imageDeleteTarget?.name ?? ''}
        isPending={mutations.isRemovingImage}
        onConfirm={() => {
          if (imageDeleteTarget) {
            mutations.removeImageFile(
              { workspaceId, imageId: imageDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/image/${imageDeleteTarget.id}`)
                  setImageDeleteTarget(null)
                }
              }
            )
          }
        }}
      />
    </>
  )
}
