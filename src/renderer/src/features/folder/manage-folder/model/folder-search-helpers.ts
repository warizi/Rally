/**
 * 파일 탐색기 검색 — 순수 헬퍼.
 *
 * tree DFS 로 매칭 노드 / ancestor 폴더 / DFS 순서를 계산.
 * React / dnd-kit 의존 0 → 단위 테스트로 검증.
 */
import type { WorkspaceTreeNode, FolderTreeNode } from './types'

export interface SearchResult {
  /** 쿼리에 매치된 노드 id 집합 (빠른 lookup). */
  matchedIds: Set<string>
  /** DFS 순서로 매치된 노드 id (↑↓ 이동 순서). */
  orderedMatches: string[]
  /** 매치된 노드를 화면에 보이게 하기 위해 펼쳐야 하는 폴더 id 집합. */
  ancestorIds: Set<string>
}

const EMPTY_RESULT: SearchResult = {
  matchedIds: new Set(),
  orderedMatches: [],
  ancestorIds: new Set()
}

/**
 * 트리 전체를 DFS 순회하면서 쿼리에 매치되는 노드를 찾는다.
 *
 * - case-insensitive substring 매칭 (`name.toLowerCase().includes(q)`)
 * - 빈 / 공백만 쿼리 → 빈 결과
 * - 폴더와 파일 (note/csv/pdf/image) 모두 매칭 대상
 * - 매치된 노드의 ancestor 폴더 id 도 함께 수집 (자동 펼침용)
 */
export function searchTree(tree: WorkspaceTreeNode[], query: string): SearchResult {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length === 0) return EMPTY_RESULT

  const matchedIds = new Set<string>()
  const orderedMatches: string[] = []
  const ancestorIds = new Set<string>()

  function visit(nodes: WorkspaceTreeNode[], ancestors: string[]): void {
    for (const node of nodes) {
      const isMatch = node.name.toLowerCase().includes(trimmed)
      if (isMatch) {
        matchedIds.add(node.id)
        orderedMatches.push(node.id)
        for (const a of ancestors) ancestorIds.add(a)
      }
      if (node.kind === 'folder') {
        // 폴더 자신이 매치든 아니든 자손 탐색은 동일
        ancestors.push(node.id)
        visit(node.children, ancestors)
        ancestors.pop()
      }
    }
  }

  visit(tree, [])

  return { matchedIds, orderedMatches, ancestorIds }
}

/**
 * 트리에서 특정 노드의 부모 폴더 체인을 root → leaf 순으로 반환.
 * 없으면 빈 배열. 노드 자체는 포함하지 않음.
 */
export function findAncestors(tree: WorkspaceTreeNode[], targetId: string): string[] {
  function visit(nodes: WorkspaceTreeNode[], path: string[]): string[] | null {
    for (const node of nodes) {
      if (node.id === targetId) return path
      if (node.kind === 'folder') {
        const found = visit(node.children, [...path, node.id])
        if (found) return found
      }
    }
    return null
  }
  return visit(tree, []) ?? []
}

/**
 * `searchTree` 결과의 활성 매치 인덱스 위/아래 이동.
 * 매치가 비어있으면 -1, 그 외 wrap-around.
 */
export function moveActiveIndex(
  orderedMatches: string[],
  currentIndex: number,
  direction: 'prev' | 'next'
): number {
  if (orderedMatches.length === 0) return -1
  if (currentIndex < 0) {
    return direction === 'next' ? 0 : orderedMatches.length - 1
  }
  const delta = direction === 'next' ? 1 : -1
  const n = orderedMatches.length
  return (currentIndex + delta + n) % n
}

/** type guard. */
export function isFolderNode(node: WorkspaceTreeNode): node is FolderTreeNode {
  return node.kind === 'folder'
}
