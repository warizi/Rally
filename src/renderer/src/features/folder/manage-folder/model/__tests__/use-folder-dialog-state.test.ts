/**
 * use-folder-dialog-state 단위 테스트 (P1-3 follow-up).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFolderDialogState } from '../use-folder-dialog-state'

describe('useFolderDialogState', () => {
  beforeEach(() => {
    // 각 테스트 격리
  })

  it('initial state: all 8 targets are null', () => {
    const { result } = renderHook(() => useFolderDialogState())
    expect(result.current.createTarget).toBeNull()
    expect(result.current.renameTarget).toBeNull()
    expect(result.current.colorTarget).toBeNull()
    expect(result.current.deleteTarget).toBeNull()
    expect(result.current.noteDeleteTarget).toBeNull()
    expect(result.current.csvDeleteTarget).toBeNull()
    expect(result.current.pdfDeleteTarget).toBeNull()
    expect(result.current.imageDeleteTarget).toBeNull()
  })

  it('setCreateTarget / setRenameTarget / setColorTarget / setDeleteTarget update independently', () => {
    const { result } = renderHook(() => useFolderDialogState())

    act(() => {
      result.current.setCreateTarget({ parentFolderId: 'p1' })
    })
    expect(result.current.createTarget).toEqual({ parentFolderId: 'p1' })

    act(() => {
      result.current.setRenameTarget({ id: 'f1', name: 'Old' })
    })
    expect(result.current.renameTarget).toEqual({ id: 'f1', name: 'Old' })

    // 다른 target 영향 없음
    expect(result.current.createTarget).toEqual({ parentFolderId: 'p1' })

    act(() => {
      result.current.setColorTarget({ id: 'f1', color: '#ff0000' })
    })
    expect(result.current.colorTarget).toEqual({ id: 'f1', color: '#ff0000' })

    act(() => {
      result.current.setDeleteTarget({ id: 'f1', name: 'Old' })
    })
    expect(result.current.deleteTarget).toEqual({ id: 'f1', name: 'Old' })
  })

  it('file delete targets isolate by entity kind', () => {
    const { result } = renderHook(() => useFolderDialogState())

    act(() => {
      result.current.setNoteDeleteTarget({ id: 'n1', name: 'note' })
      result.current.setCsvDeleteTarget({ id: 'c1', name: 'csv' })
      result.current.setPdfDeleteTarget({ id: 'p1', name: 'pdf' })
      result.current.setImageDeleteTarget({ id: 'i1', name: 'image' })
    })

    expect(result.current.noteDeleteTarget).toEqual({ id: 'n1', name: 'note' })
    expect(result.current.csvDeleteTarget).toEqual({ id: 'c1', name: 'csv' })
    expect(result.current.pdfDeleteTarget).toEqual({ id: 'p1', name: 'pdf' })
    expect(result.current.imageDeleteTarget).toEqual({ id: 'i1', name: 'image' })
  })

  it('setters accept null to close dialog', () => {
    const { result } = renderHook(() => useFolderDialogState())

    act(() => {
      result.current.setCreateTarget({ parentFolderId: null })
    })
    expect(result.current.createTarget).not.toBeNull()

    act(() => {
      result.current.setCreateTarget(null)
    })
    expect(result.current.createTarget).toBeNull()
  })
})
