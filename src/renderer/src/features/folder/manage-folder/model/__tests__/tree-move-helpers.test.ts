/**
 * tree-move-helpers 단위 테스트 (P1-3 follow-up 2).
 *
 * S2 노트 이동 / S3 자손 드롭 차단 / index 계산 의미론을 데이터 레이어에서 검증.
 */
import { describe, it, expect } from 'vitest'
import {
  findChildrenByParentId,
  findChildrenStrict,
  isRelevantSiblingKind,
  calculateMoveIndex,
  calculateAppendIndex,
  isSelfDrop
} from '../tree-move-helpers'
import type { WorkspaceTreeNode } from '../types'

function folder(id: string, children: WorkspaceTreeNode[] = []): WorkspaceTreeNode {
  return { id, kind: 'folder', name: id, color: null, children } as unknown as WorkspaceTreeNode
}

function note(id: string): WorkspaceTreeNode {
  return { id, kind: 'note', name: id, folderId: null } as unknown as WorkspaceTreeNode
}

function csv(id: string): WorkspaceTreeNode {
  return { id, kind: 'csv', name: id, folderId: null } as unknown as WorkspaceTreeNode
}

function pdf(id: string): WorkspaceTreeNode {
  return { id, kind: 'pdf', name: id, folderId: null } as unknown as WorkspaceTreeNode
}

describe('findChildrenByParentId', () => {
  const tree: WorkspaceTreeNode[] = [
    folder('A', [note('a1'), csv('a2'), folder('A-nested', [pdf('an1')])]),
    folder('B', []),
    note('root-note')
  ]

  it('returns root nodes when parentId is null', () => {
    expect(findChildrenByParentId(tree, null)).toBe(tree)
  })

  it('returns folder children when folder exists', () => {
    const aChildren = findChildrenByParentId(tree, 'A')
    expect(aChildren.map((n) => n.id)).toEqual(['a1', 'a2', 'A-nested'])
  })

  it('returns nested folder children (recursive)', () => {
    expect(findChildrenByParentId(tree, 'A-nested').map((n) => n.id)).toEqual(['an1'])
  })

  it('returns empty array for empty folder', () => {
    expect(findChildrenByParentId(tree, 'B')).toEqual([])
  })

  it('returns empty array when parentId does not exist', () => {
    expect(findChildrenByParentId(tree, 'nonexistent')).toEqual([])
  })

  it('distinguishes "empty folder" from "not found" via findChildrenStrict', () => {
    expect(findChildrenStrict(tree, 'B')).toEqual([]) // 빈 폴더
    expect(findChildrenStrict(tree, 'nonexistent')).toBeNull() // 없음
  })
})

describe('isRelevantSiblingKind', () => {
  it('folder source matches only folder siblings', () => {
    expect(isRelevantSiblingKind('folder', 'folder')).toBe(true)
    expect(isRelevantSiblingKind('folder', 'note')).toBe(false)
    expect(isRelevantSiblingKind('folder', 'csv')).toBe(false)
  })

  it('leaf source matches any non-folder sibling (note/csv/pdf/image share order space)', () => {
    expect(isRelevantSiblingKind('note', 'csv')).toBe(true)
    expect(isRelevantSiblingKind('note', 'pdf')).toBe(true)
    expect(isRelevantSiblingKind('csv', 'image')).toBe(true)
    expect(isRelevantSiblingKind('note', 'folder')).toBe(false)
  })
})

describe('calculateMoveIndex (S2 노트 이동 의미론)', () => {
  const siblings: WorkspaceTreeNode[] = [
    folder('F1'),
    note('n1'),
    csv('c1'),
    folder('F2'),
    pdf('p1'),
    note('n2')
  ]

  it('leaf source: counts only non-folder siblings before combinedIndex', () => {
    // n1 을 인덱스 4(p1 자리)로 이동 → 자기 자신 제외, F1/F2 폴더 제외 → c1 만 카운트 → index 1
    expect(calculateMoveIndex(siblings, 4, 'n1', 'note')).toBe(1)
  })

  it('leaf source: excludes self when present in slice', () => {
    // n1 자신을 포함한 슬라이스에서 자기 자신 카운트 안 됨
    expect(calculateMoveIndex(siblings, 2, 'n1', 'note')).toBe(0)
  })

  it('folder source: counts only folder siblings', () => {
    // F1 을 인덱스 5(n2 자리)로 → 자기 자신 제외, F2 만 카운트 → index 1
    expect(calculateMoveIndex(siblings, 5, 'F1', 'folder')).toBe(1)
  })

  it('combinedIndex 0 → always 0 (맨 앞)', () => {
    expect(calculateMoveIndex(siblings, 0, 'n1', 'note')).toBe(0)
    expect(calculateMoveIndex(siblings, 0, 'F1', 'folder')).toBe(0)
  })
})

describe('calculateAppendIndex (폴더 안 끝에 추가)', () => {
  it('leaf source: 폴더 안 leaf 개수 (자기 제외)', () => {
    const folderChildren = [note('n1'), csv('c1'), pdf('p1')]
    expect(calculateAppendIndex(folderChildren, 'new', 'note')).toBe(3)
    expect(calculateAppendIndex(folderChildren, 'c1', 'note')).toBe(2) // 자기 제외
  })

  it('folder source: 폴더 안 folder 개수 (자기 제외)', () => {
    const folderChildren = [folder('F1'), note('n1'), folder('F2')]
    expect(calculateAppendIndex(folderChildren, 'new', 'folder')).toBe(2)
    expect(calculateAppendIndex(folderChildren, 'F1', 'folder')).toBe(1)
  })

  it('빈 폴더 → 0', () => {
    expect(calculateAppendIndex([], 'new', 'note')).toBe(0)
  })
})

describe('isSelfDrop (S3 자기 자신 드롭 차단)', () => {
  it('tree-position: anchor === source 면 자기 위/아래 드롭으로 차단', () => {
    expect(isSelfDrop({ target: 'tree-position', sourceId: 'n1', anchorNodeId: 'n1' })).toBe(true)
    expect(isSelfDrop({ target: 'tree-position', sourceId: 'n1', anchorNodeId: 'n2' })).toBe(false)
  })

  it('tree-into: folderId === source 면 자기 폴더 안 드롭으로 차단', () => {
    expect(isSelfDrop({ target: 'tree-into', sourceId: 'F1', folderId: 'F1' })).toBe(true)
    expect(isSelfDrop({ target: 'tree-into', sourceId: 'F1', folderId: 'F2' })).toBe(false)
  })
})
