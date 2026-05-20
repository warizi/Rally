import { useCallback } from 'react'
import type { NodeApi } from '../lib/tree'
import type { WorkspaceTreeNode } from './types'
import type { FolderDialogState } from './use-folder-dialog-state'

/**
 * react-arborist `<Tree>` 컴포넌트의 onCreate / onRename / onDelete 핸들러 묶음.
 *
 * onMove 는 react-arborist 내장 DnD 가 비활성화되어 호출되지 않음 — 트리 내 이동은
 * `useTreeMoveListener` (별도 hook, MainLayout 의 @dnd-kit 기반) 에서 처리한다.
 */

interface UseHandlersOptions {
  workspaceId: string
  rename: (
    args: { workspaceId: string; folderId: string; newName: string },
    options: { onSuccess: () => void }
  ) => void
  dialogState: FolderDialogState
}

export interface TreeHandlers {
  onCreate: ({ parentId }: { parentId: string | null }) => null
  onRename: ({ id, name }: { id: string; name: string }) => void
  onDelete: ({ ids, nodes }: { ids: string[]; nodes: NodeApi<WorkspaceTreeNode>[] }) => void
}

export function useFolderTreeHandlers(options: UseHandlersOptions): TreeHandlers {
  const { workspaceId, rename, dialogState } = options
  const {
    setCreateTarget,
    setNoteDeleteTarget,
    setCsvDeleteTarget,
    setPdfDeleteTarget,
    setImageDeleteTarget,
    setDeleteTarget
  } = dialogState

  const onCreate = useCallback(
    ({ parentId }: { parentId: string | null }) => {
      setCreateTarget({ parentFolderId: parentId ?? null })
      return null
    },
    [setCreateTarget]
  )

  const onRename = useCallback(
    ({ id, name }: { id: string; name: string }) => {
      // react-arborist 인라인 rename 은 폴더 전용 (disableEdit 으로 노트 진입 차단)
      rename({ workspaceId, folderId: id, newName: name }, { onSuccess: () => {} })
    },
    [workspaceId, rename]
  )

  const onDelete = useCallback(
    ({ ids, nodes }: { ids: string[]; nodes: NodeApi<WorkspaceTreeNode>[] }) => {
      if (nodes.length === 0) return
      const firstNode = nodes[0]
      const target = { id: ids[0], name: firstNode.data.name }
      if (firstNode.data.kind === 'note') setNoteDeleteTarget(target)
      else if (firstNode.data.kind === 'csv') setCsvDeleteTarget(target)
      else if (firstNode.data.kind === 'pdf') setPdfDeleteTarget(target)
      else if (firstNode.data.kind === 'image') setImageDeleteTarget(target)
      else setDeleteTarget(target)
    },
    [
      setNoteDeleteTarget,
      setCsvDeleteTarget,
      setPdfDeleteTarget,
      setImageDeleteTarget,
      setDeleteTarget
    ]
  )

  return { onCreate, onRename, onDelete }
}
