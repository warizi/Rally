import {
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useUpdateFolderMeta
} from '@entities/folder'
import { useDuplicateNote, useRemoveNote } from '@entities/note'
import { useDuplicateCsvFile, useRemoveCsvFile } from '@entities/csv-file'
import { useDuplicatePdfFile, useRemovePdfFile } from '@entities/pdf-file'
import { useDuplicateImageFile, useRemoveImageFile } from '@entities/image-file'

/**
 * FolderTree 에서 사용하는 8 mutation hook 묶음.
 *
 * 도메인:
 *   - folder: create / rename / remove / updateMeta (각 isPending 동반)
 *   - note: duplicate / remove
 *   - csv: duplicate / remove
 *   - pdf: duplicate / remove
 *   - image: duplicate / remove
 *
 * UI 영향 없음 — `useXxxMutation()` 8개를 한 호출로 묶는 단순 리팩토링.
 * P1-3 Phase 2: FolderTree.tsx 슬림화 (~15L 감소).
 *
 * 반환 형태는 flat (각 이름 유지) — 호출 측 변경 최소화.
 */
export function useFolderMutations() {
  const { mutate: createFolder, isPending: isCreatingFolder } = useCreateFolder()
  const { mutate: rename, isPending: isRenaming } = useRenameFolder()
  const { mutate: remove, isPending: isRemoving } = useRemoveFolder()
  const { mutate: updateMeta, isPending: isUpdatingMeta } = useUpdateFolderMeta()

  const { mutate: duplicateNote } = useDuplicateNote()
  const { mutate: removeNote, isPending: isRemovingNote } = useRemoveNote()
  const { mutate: duplicateCsvFile } = useDuplicateCsvFile()
  const { mutate: removeCsvFile, isPending: isRemovingCsv } = useRemoveCsvFile()
  const { mutate: duplicatePdfFile } = useDuplicatePdfFile()
  const { mutate: removePdfFile, isPending: isRemovingPdf } = useRemovePdfFile()
  const { mutate: duplicateImageFile } = useDuplicateImageFile()
  const { mutate: removeImageFile, isPending: isRemovingImage } = useRemoveImageFile()

  return {
    // folder
    createFolder,
    isCreatingFolder,
    rename,
    isRenaming,
    remove,
    isRemoving,
    updateMeta,
    isUpdatingMeta,
    // note
    duplicateNote,
    removeNote,
    isRemovingNote,
    // csv
    duplicateCsvFile,
    removeCsvFile,
    isRemovingCsv,
    // pdf
    duplicatePdfFile,
    removePdfFile,
    isRemovingPdf,
    // image
    duplicateImageFile,
    removeImageFile,
    isRemovingImage
  }
}
