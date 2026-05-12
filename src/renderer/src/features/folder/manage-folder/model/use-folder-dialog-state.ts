import { useState } from 'react'

/**
 * FolderTree 의 8개 dialog state 를 단일 훅으로 묶음.
 *
 * - Folder: create / rename / color / delete (4개)
 * - File: note delete / csv delete / pdf delete / image delete (4개)
 *
 * UI 영향 없음 — useState 들을 한 곳에 모으는 단순 리팩토링.
 * P1-3 Phase 1: FolderTree.tsx 슬림화의 첫 단계.
 */

export interface FolderCreateTarget {
  parentFolderId: string | null
}

export interface IdNameTarget {
  id: string
  name: string
}

export interface IdColorTarget {
  id: string
  color: string | null
}

export interface FolderDialogState {
  // Folder
  createTarget: FolderCreateTarget | null
  setCreateTarget: (v: FolderCreateTarget | null) => void
  renameTarget: IdNameTarget | null
  setRenameTarget: (v: IdNameTarget | null) => void
  colorTarget: IdColorTarget | null
  setColorTarget: (v: IdColorTarget | null) => void
  deleteTarget: IdNameTarget | null
  setDeleteTarget: (v: IdNameTarget | null) => void

  // File
  noteDeleteTarget: IdNameTarget | null
  setNoteDeleteTarget: (v: IdNameTarget | null) => void
  csvDeleteTarget: IdNameTarget | null
  setCsvDeleteTarget: (v: IdNameTarget | null) => void
  pdfDeleteTarget: IdNameTarget | null
  setPdfDeleteTarget: (v: IdNameTarget | null) => void
  imageDeleteTarget: IdNameTarget | null
  setImageDeleteTarget: (v: IdNameTarget | null) => void
}

export function useFolderDialogState(): FolderDialogState {
  const [createTarget, setCreateTarget] = useState<FolderCreateTarget | null>(null)
  const [renameTarget, setRenameTarget] = useState<IdNameTarget | null>(null)
  const [colorTarget, setColorTarget] = useState<IdColorTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IdNameTarget | null>(null)
  const [noteDeleteTarget, setNoteDeleteTarget] = useState<IdNameTarget | null>(null)
  const [csvDeleteTarget, setCsvDeleteTarget] = useState<IdNameTarget | null>(null)
  const [pdfDeleteTarget, setPdfDeleteTarget] = useState<IdNameTarget | null>(null)
  const [imageDeleteTarget, setImageDeleteTarget] = useState<IdNameTarget | null>(null)

  return {
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
  }
}
