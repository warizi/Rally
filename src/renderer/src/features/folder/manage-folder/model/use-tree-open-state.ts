import { useCallback, useMemo } from 'react'
import type { TreeApi } from 'react-arborist'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { WorkspaceTreeNode } from './types'

const OPEN_STATE_KEY = 'folderOpenState'

function parseOpenState(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

/** 트리에서 targetId까지의 폴더 경로를 반환 */
function findAncestorFolderIds(
  nodes: WorkspaceTreeNode[],
  targetId: string
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return []
    if (node.kind === 'folder') {
      const path = findAncestorFolderIds(node.children, targetId)
      if (path !== null) return [node.id, ...path]
    }
  }
  return null
}

/**
 * 폴더 트리 열림/닫힘 상태를 탭 searchParams에 영속
 */
export function useTreeOpenState(tabId: string | undefined): {
  openState: Record<string, boolean>
  toggle: (id: string, isOpen: boolean) => void
  collapseAll: () => void
  expandToItem: (tree: WorkspaceTreeNode[], itemId: string, treeApi?: TreeApi<WorkspaceTreeNode> | null) => void
} {
  const searchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)

  const openState = useMemo(() => parseOpenState(searchParams?.[OPEN_STATE_KEY]), [searchParams])

  const toggle = useCallback(
    (id: string, isOpen: boolean) => {
      if (!tabId) return
      const current = parseOpenState(searchParams?.[OPEN_STATE_KEY])
      const next = { ...current, [id]: isOpen }
      navigateTab(tabId, {
        searchParams: { ...searchParams, [OPEN_STATE_KEY]: JSON.stringify(next) }
      })
    },
    [tabId, searchParams, navigateTab]
  )

  const collapseAll = useCallback(() => {
    if (!tabId) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [OPEN_STATE_KEY]: _, ...rest } = searchParams ?? {}
    navigateTab(tabId, { searchParams: rest })
  }, [tabId, searchParams, navigateTab])

  const expandToItem = useCallback(
    (tree: WorkspaceTreeNode[], itemId: string, treeApi?: TreeApi<WorkspaceTreeNode> | null) => {
      if (!tabId) return
      const ancestors = findAncestorFolderIds(tree, itemId)
      if (!ancestors || ancestors.length === 0) return
      const current = parseOpenState(searchParams?.[OPEN_STATE_KEY])
      // 이미 모두 열려있으면 skip
      if (ancestors.every((id) => current[id])) return
      const next = { ...current }
      for (const id of ancestors) {
        next[id] = true
        treeApi?.open(id)
      }
      navigateTab(tabId, {
        searchParams: { ...searchParams, [OPEN_STATE_KEY]: JSON.stringify(next) }
      })
    },
    [tabId, searchParams, navigateTab]
  )

  return { openState, toggle, collapseAll, expandToItem }
}
