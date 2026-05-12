/**
 * P1-3 진입 게이트: FolderTree.tsx 회귀 안전망.
 *
 * 본 파일은 FolderTree.tsx에서 추출한 3개 헬퍼의 단위 테스트.
 * P1-3 리팩토링(951L → ≤150L) 중 이들이 분리/이동될 때 회귀를 자동 차단.
 *
 * UI 통합 테스트(react-arborist + DndContext + 11개 핸들러)는 깨지기 쉬워
 * 본 게이트는 데이터/계산 레이어에 집중. UI 통합은 P1-3 작업 직전 별도 추가.
 */
import { describe, it, expect } from 'vitest'
import {
  collectDescendantPathnames,
  findFolderNode,
  countVisibleNodes
} from '../folder-tree-helpers'
import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode } from '../types'

// ─────────────────────────────────────────────────────────────
// 픽스처 빌더
// ─────────────────────────────────────────────────────────────
function note(id: string, folderId: string | null = null, order = 0): NoteTreeNode {
  return {
    kind: 'note',
    id,
    name: id,
    relativePath: `${id}.md`,
    extension: '.md',
    description: '',
    preview: '',
    folderId,
    order
  }
}

function folder(
  id: string,
  children: WorkspaceTreeNode[] = [],
  order = 0
): FolderTreeNode {
  return {
    kind: 'folder',
    id,
    name: id,
    relativePath: id,
    color: null,
    order,
    children
  }
}

// ─────────────────────────────────────────────────────────────
// S1 — collectDescendantPathnames
// ─────────────────────────────────────────────────────────────
describe('collectDescendantPathnames', () => {
  it('S1.1 — empty tree returns empty array', () => {
    expect(collectDescendantPathnames([])).toEqual([])
  })

  it('S1.2 — mixed leaf entities map to their kind-specific prefix', () => {
    const tree: WorkspaceTreeNode[] = [
      note('n1'),
      { ...note('c1'), kind: 'csv' } as WorkspaceTreeNode,
      { ...note('p1'), kind: 'pdf' } as WorkspaceTreeNode,
      { ...note('i1'), kind: 'image' } as WorkspaceTreeNode
    ]
    expect(collectDescendantPathnames(tree)).toEqual([
      '/folder/note/n1',
      '/folder/csv/c1',
      '/folder/pdf/p1',
      '/folder/image/i1'
    ])
  })

  it('S1.3 — folder itself is not collected; only its leaf descendants', () => {
    const tree: WorkspaceTreeNode[] = [folder('f1', [note('n1'), note('n2')])]
    // 폴더 f1 자체는 path 없음
    expect(collectDescendantPathnames(tree)).toEqual(['/folder/note/n1', '/folder/note/n2'])
  })

  it('S1.4 — deep nested folders recursively collect leaves', () => {
    const tree: WorkspaceTreeNode[] = [
      folder('top', [folder('mid', [folder('deep', [note('n-deep')])])])
    ]
    expect(collectDescendantPathnames(tree)).toEqual(['/folder/note/n-deep'])
  })
})

// ─────────────────────────────────────────────────────────────
// S2 — findFolderNode
// ─────────────────────────────────────────────────────────────
describe('findFolderNode', () => {
  it('S2.1 — finds folder at root level', () => {
    const tree: WorkspaceTreeNode[] = [folder('f1'), folder('f2')]
    const result = findFolderNode(tree, 'f2')
    expect(result?.id).toBe('f2')
    expect(result?.kind).toBe('folder')
  })

  it('S2.2 — finds folder nested deep in subtree', () => {
    const deep = folder('deep')
    const tree: WorkspaceTreeNode[] = [folder('top', [folder('mid', [deep])])]
    const result = findFolderNode(tree, 'deep')
    expect(result).toBe(deep)
  })

  it('S2.3 — returns null when id is a non-folder node', () => {
    const tree: WorkspaceTreeNode[] = [folder('f1', [note('n1')])]
    expect(findFolderNode(tree, 'n1')).toBeNull()
  })

  it('S2.4 — returns null when id does not exist', () => {
    const tree: WorkspaceTreeNode[] = [folder('f1', [folder('f2')])]
    expect(findFolderNode(tree, 'does-not-exist')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// S3 — countVisibleNodes
// ─────────────────────────────────────────────────────────────
describe('countVisibleNodes', () => {
  it('S3.1 — counts only root-level nodes when no folder is open', () => {
    const tree: WorkspaceTreeNode[] = [folder('f1', [note('n1'), note('n2')]), note('root-note')]
    // f1 닫힘 → n1/n2 안 보임 → f1 + root-note = 2
    expect(countVisibleNodes(tree, {})).toBe(2)
  })

  it('S3.2 — includes children of open folders', () => {
    const tree: WorkspaceTreeNode[] = [folder('f1', [note('n1'), note('n2')])]
    expect(countVisibleNodes(tree, { f1: true })).toBe(3)
  })

  it('S3.3 — nested open folders recursively expand count', () => {
    // top { mid { deep { n1 } }, sibling }
    const tree: WorkspaceTreeNode[] = [
      folder('top', [folder('mid', [folder('deep', [note('n1')])]), note('sibling')])
    ]
    // 전부 열려있을 때: top + mid + deep + n1 + sibling = 5
    expect(countVisibleNodes(tree, { top: true, mid: true, deep: true })).toBe(5)
    // mid 만 닫혀있을 때: top + mid + sibling = 3 (mid 안 펼침)
    expect(countVisibleNodes(tree, { top: true, mid: false })).toBe(3)
  })

  it('S3.4 — note nodes are always counted but never expand (no children)', () => {
    const tree: WorkspaceTreeNode[] = [note('a'), note('b'), note('c')]
    expect(countVisibleNodes(tree, { a: true, b: true })).toBe(3)
  })
})
