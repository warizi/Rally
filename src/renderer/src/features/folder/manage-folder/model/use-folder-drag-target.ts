import { useMemo } from 'react'
import { useDndContext } from '@dnd-kit/core'
import type { TreeDragData, TreeDropData } from '@shared/types/tree-drag'

interface FolderDragTarget {
  isFolderDrag: boolean
  /**
   * 폴더 드래그 중 cursor가 해석된 "드롭 대상 폴더" id.
   * 폴더에 hover하면 그 폴더, 폴더 안의 자식에 hover하면 그 부모 폴더.
   * 루트(워크스페이스 직속) 또는 폴더 드래그가 아니면 null.
   */
  targetFolderId: string | null
}

/**
 * 폴더 source 드래그의 시각 피드백을 위한 hook.
 * FolderNodeRenderer에서 자기가 타겟 폴더인지 판단할 때 사용.
 */
export function useFolderDragTarget(): FolderDragTarget {
  const { active, over } = useDndContext()
  const sourceData = active?.data.current as TreeDragData | undefined
  const isFolderDrag = sourceData?.source === 'tree-node' && sourceData.kind === 'folder'

  const targetFolderId = useMemo<string | null>(() => {
    if (!isFolderDrag) return null
    const data = over?.data.current as TreeDropData | undefined
    if (!data) return null
    if (data.target === 'tree-into') return data.folderId
    if (data.target === 'tree-position') return data.parentId
    return null
  }, [isFolderDrag, over])

  return { isFolderDrag, targetFolderId }
}
