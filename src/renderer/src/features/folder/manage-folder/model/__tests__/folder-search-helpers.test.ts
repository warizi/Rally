/**
 * folder-search-helpers 단위 테스트 (Phase 1).
 */
import { describe, it, expect } from 'vitest'
import { searchTree, findAncestors, moveActiveIndex } from '../folder-search-helpers'
import type { WorkspaceTreeNode } from '../types'

function folder(id: string, name: string, children: WorkspaceTreeNode[] = []): WorkspaceTreeNode {
  return {
    kind: 'folder',
    id,
    name,
    color: null,
    children
  } as unknown as WorkspaceTreeNode
}

function note(id: string, name: string): WorkspaceTreeNode {
  return { kind: 'note', id, name, folderId: null } as unknown as WorkspaceTreeNode
}

function csv(id: string, name: string): WorkspaceTreeNode {
  return { kind: 'csv', id, name, folderId: null } as unknown as WorkspaceTreeNode
}

/*
 * 테스트용 트리:
 *   root
 *   ├── A (folder)
 *   │   ├── apple (note)
 *   │   └── B (folder)
 *   │       └── banana (note)
 *   ├── alpha (folder)
 *   │   └── beta (csv)
 *   └── carrot (note)
 */
const tree: WorkspaceTreeNode[] = [
  folder('f-A', 'A', [note('n-apple', 'apple'), folder('f-B', 'B', [note('n-banana', 'banana')])]),
  folder('f-alpha', 'alpha', [csv('c-beta', 'beta')]),
  note('n-carrot', 'carrot')
]

describe('searchTree', () => {
  it('빈 쿼리 → 빈 결과', () => {
    const r = searchTree(tree, '')
    expect(r.matchedIds.size).toBe(0)
    expect(r.orderedMatches).toEqual([])
    expect(r.ancestorIds.size).toBe(0)
  })

  it('공백만 쿼리 → 빈 결과', () => {
    const r = searchTree(tree, '   ')
    expect(r.matchedIds.size).toBe(0)
  })

  it('case-insensitive substring 매칭', () => {
    const r = searchTree(tree, 'APP')
    expect(r.matchedIds.has('n-apple')).toBe(true)
    expect(r.matchedIds.size).toBe(1)
  })

  it('여러 깊이의 매치 + ancestor 수집', () => {
    const r = searchTree(tree, 'ban')
    expect(r.matchedIds).toEqual(new Set(['n-banana']))
    expect(r.ancestorIds).toEqual(new Set(['f-A', 'f-B'])) // banana 의 ancestors
  })

  it('orderedMatches 는 DFS 순서 (위에서 아래)', () => {
    const r = searchTree(tree, 'a')
    // DFS: A(매치), apple(매치), B(없음), banana(매치), alpha(매치), beta(매치 — 'a' 포함), carrot(매치)
    expect(r.orderedMatches).toEqual([
      'f-A',
      'n-apple',
      'n-banana',
      'f-alpha',
      'c-beta',
      'n-carrot'
    ])
  })

  it('폴더 이름 매치 시 ancestor 에 자기 자신은 포함 안 함', () => {
    const r = searchTree(tree, 'alpha')
    expect(r.matchedIds).toEqual(new Set(['f-alpha']))
    // alpha 는 root 레벨이라 ancestor 없음
    expect(r.ancestorIds).toEqual(new Set())
  })

  it('매치 없음 → 빈 결과', () => {
    const r = searchTree(tree, 'zzzz')
    expect(r.matchedIds.size).toBe(0)
    expect(r.orderedMatches).toEqual([])
    expect(r.ancestorIds.size).toBe(0)
  })

  it('파일 type 모두 매칭 대상 (note + csv)', () => {
    const r = searchTree(tree, 'beta')
    expect(r.matchedIds).toEqual(new Set(['c-beta']))
  })
})

describe('findAncestors', () => {
  it('root 노드 → 빈 배열', () => {
    expect(findAncestors(tree, 'f-A')).toEqual([])
    expect(findAncestors(tree, 'n-carrot')).toEqual([])
  })

  it('중첩 노드 → 부모 폴더 체인 (root → leaf 순)', () => {
    expect(findAncestors(tree, 'n-banana')).toEqual(['f-A', 'f-B'])
    expect(findAncestors(tree, 'n-apple')).toEqual(['f-A'])
  })

  it('존재하지 않는 id → 빈 배열', () => {
    expect(findAncestors(tree, 'nonexistent')).toEqual([])
  })
})

describe('moveActiveIndex', () => {
  it('빈 매치 → -1', () => {
    expect(moveActiveIndex([], -1, 'next')).toBe(-1)
    expect(moveActiveIndex([], 0, 'prev')).toBe(-1)
  })

  it('current=-1 시 next → 0, prev → 마지막', () => {
    const m = ['a', 'b', 'c']
    expect(moveActiveIndex(m, -1, 'next')).toBe(0)
    expect(moveActiveIndex(m, -1, 'prev')).toBe(2)
  })

  it('next 시 wrap-around (마지막 → 0)', () => {
    const m = ['a', 'b', 'c']
    expect(moveActiveIndex(m, 2, 'next')).toBe(0)
  })

  it('prev 시 wrap-around (0 → 마지막)', () => {
    const m = ['a', 'b', 'c']
    expect(moveActiveIndex(m, 0, 'prev')).toBe(2)
  })

  it('일반 이동', () => {
    const m = ['a', 'b', 'c']
    expect(moveActiveIndex(m, 0, 'next')).toBe(1)
    expect(moveActiveIndex(m, 1, 'next')).toBe(2)
    expect(moveActiveIndex(m, 2, 'prev')).toBe(1)
  })
})
