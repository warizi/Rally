import { useCallback } from 'react'
import { useCreateNote, useImportNote } from '@entities/note'
import type { NoteNode } from '@entities/note'
import { useCreateCsvFile, useImportCsvFile } from '@entities/csv-file'
import type { CsvFileNode } from '@entities/csv-file'
import { useImportPdfFile } from '@entities/pdf-file'
import { useImportImageFile } from '@entities/image-file'
import type { ImageFileNode } from '@entities/image-file'
import { useTabStore } from '@features/tab-system/manage-tab-system'

/**
 * FolderTree 의 6개 생성/import 핸들러를 묶은 훅.
 *
 * 모든 핸들러가 동일 패턴:
 *   1. mutation 실행 (create 또는 import)
 *   2. 성공 시 openRightTab 으로 새 탭에 자동 오픈
 *
 * UI 영향 없음 — FolderTree 의 useCallback 들을 한 곳으로 이동.
 * P1-3 Phase 1: FolderTree.tsx 슬림화.
 */
export interface FolderCreateHandlers {
  handleCreateNote: (folderId: string | null) => void
  handleCreateCsv: (folderId: string | null) => void
  handleImportNote: (folderId: string | null) => Promise<void>
  handleImportCsv: (folderId: string | null) => Promise<void>
  handleImportPdf: (folderId: string | null) => Promise<void>
  handleImportImage: (folderId: string | null) => Promise<void>
}

interface UseHandlersOptions {
  workspaceId: string
  sourcePaneId: string
}

export function useFolderCreateHandlers(options: UseHandlersOptions): FolderCreateHandlers {
  const { workspaceId, sourcePaneId } = options

  const openRightTab = useTabStore((s) => s.openRightTab)
  const { mutate: createNote } = useCreateNote()
  const { mutateAsync: importNote } = useImportNote()
  const { mutate: createCsvFile } = useCreateCsvFile()
  const { mutateAsync: importCsvFile } = useImportCsvFile()
  const { mutate: importPdfFile } = useImportPdfFile()
  const { mutateAsync: importImageFile } = useImportImageFile()

  /** 노트 생성 → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleCreateNote = useCallback(
    (folderId: string | null) => {
      createNote(
        { workspaceId, folderId, name: '새로운 노트' },
        {
          onSuccess: (note) => {
            if (!note) return
            openRightTab(
              {
                type: 'note',
                title: note.title,
                pathname: `/folder/note/${note.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, createNote, openRightTab]
  )

  /** CSV 생성 → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleCreateCsv = useCallback(
    (folderId: string | null) => {
      createCsvFile(
        { workspaceId, folderId, name: '새로운 테이블' },
        {
          onSuccess: (csv) => {
            if (!csv) return
            openRightTab(
              {
                type: 'csv',
                title: csv.title,
                pathname: `/folder/csv/${csv.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, createCsvFile, openRightTab]
  )

  /** 노트 가져오기 → 다중 .md 선택 → import × N → 마지막 노트 탭 오픈 */
  const handleImportNote = useCallback(
    async (folderId: string | null) => {
      const filePaths = await window.api.note.selectFile()
      if (!filePaths || filePaths.length === 0) return
      let lastImported: NoteNode | undefined
      for (const sourcePath of filePaths) {
        lastImported = await importNote({ workspaceId, folderId, sourcePath })
      }
      if (lastImported) {
        openRightTab(
          {
            type: 'note',
            title: lastImported.title,
            pathname: `/folder/note/${lastImported.id}`
          },
          sourcePaneId
        )
      }
    },
    [workspaceId, sourcePaneId, importNote, openRightTab]
  )

  /** 테이블 가져오기 → 다중 .csv 선택 → import × N → 마지막 테이블 탭 오픈 */
  const handleImportCsv = useCallback(
    async (folderId: string | null) => {
      const filePaths = await window.api.csv.selectFile()
      if (!filePaths || filePaths.length === 0) return
      let lastImported: CsvFileNode | undefined
      for (const sourcePath of filePaths) {
        lastImported = await importCsvFile({ workspaceId, folderId, sourcePath })
      }
      if (lastImported) {
        openRightTab(
          {
            type: 'csv',
            title: lastImported.title,
            pathname: `/folder/csv/${lastImported.id}`
          },
          sourcePaneId
        )
      }
    },
    [workspaceId, sourcePaneId, importCsvFile, openRightTab]
  )

  /** PDF 가져오기 → 파일 선택 다이얼로그 → import → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleImportPdf = useCallback(
    async (folderId: string | null) => {
      const sourcePath = await window.api.pdf.selectFile()
      if (!sourcePath) return
      importPdfFile(
        { workspaceId, folderId, sourcePath },
        {
          onSuccess: (pdf) => {
            if (!pdf) return
            openRightTab(
              {
                type: 'pdf',
                title: pdf.title,
                pathname: `/folder/pdf/${pdf.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, importPdfFile, openRightTab]
  )

  /** 이미지 가져오기 → selectFile 다이얼로그 (다중 선택) → import × N → 마지막 이미지만 탭 열기 */
  const handleImportImage = useCallback(
    async (folderId: string | null) => {
      const filePaths = await window.api.image.selectFile()
      if (!filePaths || filePaths.length === 0) return
      let lastImported: ImageFileNode | undefined
      for (const sourcePath of filePaths) {
        lastImported = await importImageFile({ workspaceId, folderId, sourcePath })
      }
      if (lastImported) {
        openRightTab(
          {
            type: 'image',
            title: lastImported.title,
            pathname: `/folder/image/${lastImported.id}`
          },
          sourcePaneId
        )
      }
    },
    [workspaceId, sourcePaneId, importImageFile, openRightTab]
  )

  return {
    handleCreateNote,
    handleCreateCsv,
    handleImportNote,
    handleImportCsv,
    handleImportPdf,
    handleImportImage
  }
}
