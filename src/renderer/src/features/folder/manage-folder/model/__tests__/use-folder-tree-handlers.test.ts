/**
 * use-folder-tree-handlers 단위 테스트 (P1-3 follow-up).
 *
 * react-arborist Tree 의 onCreate/onRename/onDelete 콜백이 dialogState setter +
 * rename mutation 을 정확히 호출하는지 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { NodeApi } from '../../lib/tree'
import { useFolderTreeHandlers } from '../use-folder-tree-handlers'
import type { FolderDialogState } from '../use-folder-dialog-state'
import type { WorkspaceTreeNode } from '../types'

function makeDialogState(): FolderDialogState {
  return {
    createTarget: null,
    setCreateTarget: vi.fn(),
    renameTarget: null,
    setRenameTarget: vi.fn(),
    colorTarget: null,
    setColorTarget: vi.fn(),
    deleteTarget: null,
    setDeleteTarget: vi.fn(),
    noteDeleteTarget: null,
    setNoteDeleteTarget: vi.fn(),
    csvDeleteTarget: null,
    setCsvDeleteTarget: vi.fn(),
    pdfDeleteTarget: null,
    setPdfDeleteTarget: vi.fn(),
    imageDeleteTarget: null,
    setImageDeleteTarget: vi.fn()
  }
}

function makeNode(
  id: string,
  kind: WorkspaceTreeNode['kind'],
  name: string
): NodeApi<WorkspaceTreeNode> {
  return {
    data: { id, kind, name } as unknown as WorkspaceTreeNode
  } as unknown as NodeApi<WorkspaceTreeNode>
}

describe('useFolderTreeHandlers', () => {
  it('onCreate sets createTarget with parent id (or null for root)', () => {
    const dialogState = makeDialogState()
    const rename = vi.fn()
    const { result } = renderHook(() =>
      useFolderTreeHandlers({ workspaceId: 'ws1', rename, dialogState })
    )

    expect(result.current.onCreate({ parentId: 'folder-x' })).toBeNull()
    expect(dialogState.setCreateTarget).toHaveBeenCalledWith({ parentFolderId: 'folder-x' })

    result.current.onCreate({ parentId: null })
    expect(dialogState.setCreateTarget).toHaveBeenLastCalledWith({ parentFolderId: null })
  })

  it('onRename calls rename mutation with workspaceId/folderId/newName', () => {
    const dialogState = makeDialogState()
    const rename = vi.fn()
    const { result } = renderHook(() =>
      useFolderTreeHandlers({ workspaceId: 'ws1', rename, dialogState })
    )

    result.current.onRename({ id: 'f1', name: 'New Name' })
    expect(rename).toHaveBeenCalledWith(
      { workspaceId: 'ws1', folderId: 'f1', newName: 'New Name' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it.each([
    ['note', 'setNoteDeleteTarget'],
    ['csv', 'setCsvDeleteTarget'],
    ['pdf', 'setPdfDeleteTarget'],
    ['image', 'setImageDeleteTarget'],
    ['folder', 'setDeleteTarget']
  ] as const)('onDelete dispatches to %s setter when kind=%s', (kind, setterKey) => {
    const dialogState = makeDialogState()
    const rename = vi.fn()
    const { result } = renderHook(() =>
      useFolderTreeHandlers({ workspaceId: 'ws1', rename, dialogState })
    )

    const node = makeNode('id-1', kind, 'Name')
    result.current.onDelete({ ids: ['id-1'], nodes: [node] })
    expect(dialogState[setterKey]).toHaveBeenCalledWith({ id: 'id-1', name: 'Name' })
  })

  it('onDelete is no-op when nodes is empty', () => {
    const dialogState = makeDialogState()
    const rename = vi.fn()
    const { result } = renderHook(() =>
      useFolderTreeHandlers({ workspaceId: 'ws1', rename, dialogState })
    )

    result.current.onDelete({ ids: [], nodes: [] })
    expect(dialogState.setDeleteTarget).not.toHaveBeenCalled()
    expect(dialogState.setNoteDeleteTarget).not.toHaveBeenCalled()
  })
})
