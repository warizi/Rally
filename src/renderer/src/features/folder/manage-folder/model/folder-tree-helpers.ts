import type { WorkspaceTreeNode, FolderTreeNode } from './types'

const KIND_TO_PREFIX: Record<string, string> = {
  note: '/folder/note/',
  csv: '/folder/csv/',
  pdf: '/folder/pdf/',
  image: '/folder/image/'
}

/**
 * 트리에 포함된 모든 leaf entity(note/csv/pdf/image)의 탭 pathname 수집.
 * 폴더는 자기 자신은 path 없고 children만 재귀.
 *
 * 폴더 삭제 시 그 폴더 안의 모든 leaf 탭을 닫는 용도.
 */
export function collectDescendantPathnames(nodes: WorkspaceTreeNode[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    const prefix = KIND_TO_PREFIX[node.kind]
    if (prefix) {
      result.push(prefix + node.id)
    } else if (node.kind === 'folder') {
      result.push(...collectDescendantPathnames(node.children))
    }
  }
  return result
}

/** 트리에서 id로 폴더 노드를 깊이우선으로 찾는다. 폴더가 아니면 null. */
export function findFolderNode(nodes: WorkspaceTreeNode[], id: string): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id && node.kind === 'folder') return node as FolderTreeNode
    if (node.kind === 'folder') {
      const found = findFolderNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

/**
 * 현재 openState에 따라 트리에서 화면에 보이는 노드 수 계산.
 * react-arborist의 Tree height 계산에 사용 (각 row = ROW_HEIGHT).
 */
export function countVisibleNodes(
  nodes: WorkspaceTreeNode[],
  openState: Record<string, boolean>
): number {
  let count = 0
  for (const node of nodes) {
    count++
    if (node.kind === 'folder' && openState[node.id]) {
      count += countVisibleNodes(node.children, openState)
    }
  }
  return count
}
