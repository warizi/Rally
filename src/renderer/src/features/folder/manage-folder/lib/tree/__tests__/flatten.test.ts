import { describe, it, expect } from 'vitest'
import { flattenTree } from '../flatten'

interface TestNode {
  id: string
  kind: 'folder' | 'leaf'
  children?: TestNode[]
}

const idAccessor = (n: TestNode): string => n.id
const childrenAccessor = (n: TestNode): TestNode[] | null =>
  n.kind === 'folder' ? (n.children ?? []) : null

describe('flattenTree', () => {
  it('루트 노드만 있는 경우 (전부 leaf)', () => {
    const tree: TestNode[] = [
      { id: 'a', kind: 'leaf' },
      { id: 'b', kind: 'leaf' }
    ]
    const flat = flattenTree(tree, idAccessor, childrenAccessor, {})
    expect(flat).toEqual([
      { data: tree[0], id: 'a', level: 0, childIndex: 0, parentId: null, isLeaf: true },
      { data: tree[1], id: 'b', level: 0, childIndex: 1, parentId: null, isLeaf: true }
    ])
  })

  it('폴더가 닫혀 있으면 자식 미포함', () => {
    const tree: TestNode[] = [
      {
        id: 'folder',
        kind: 'folder',
        children: [{ id: 'child', kind: 'leaf' }]
      }
    ]
    const flat = flattenTree(tree, idAccessor, childrenAccessor, {})
    expect(flat.map((r) => r.id)).toEqual(['folder'])
    expect(flat[0].isLeaf).toBe(false)
  })

  it('폴더가 열려 있으면 자식 포함 (DFS preorder + 정확한 level)', () => {
    const tree: TestNode[] = [
      {
        id: 'f1',
        kind: 'folder',
        children: [
          {
            id: 'f1-1',
            kind: 'folder',
            children: [{ id: 'f1-1-a', kind: 'leaf' }]
          },
          { id: 'f1-b', kind: 'leaf' }
        ]
      },
      { id: 'top-leaf', kind: 'leaf' }
    ]
    const openState = { f1: true, 'f1-1': true }
    const flat = flattenTree(tree, idAccessor, childrenAccessor, openState)
    expect(flat.map((r) => ({ id: r.id, level: r.level }))).toEqual([
      { id: 'f1', level: 0 },
      { id: 'f1-1', level: 1 },
      { id: 'f1-1-a', level: 2 },
      { id: 'f1-b', level: 1 },
      { id: 'top-leaf', level: 0 }
    ])
  })

  it('childIndex 는 부모 children 배열에서의 위치', () => {
    const tree: TestNode[] = [
      {
        id: 'f',
        kind: 'folder',
        children: [
          { id: 'a', kind: 'leaf' },
          { id: 'b', kind: 'leaf' },
          { id: 'c', kind: 'leaf' }
        ]
      }
    ]
    const flat = flattenTree(tree, idAccessor, childrenAccessor, { f: true })
    expect(flat.map((r) => ({ id: r.id, childIndex: r.childIndex }))).toEqual([
      { id: 'f', childIndex: 0 },
      { id: 'a', childIndex: 0 },
      { id: 'b', childIndex: 1 },
      { id: 'c', childIndex: 2 }
    ])
  })

  it('parentId 는 직속 부모 (루트는 null)', () => {
    const tree: TestNode[] = [
      {
        id: 'root1',
        kind: 'folder',
        children: [
          {
            id: 'mid',
            kind: 'folder',
            children: [{ id: 'deep', kind: 'leaf' }]
          }
        ]
      }
    ]
    const flat = flattenTree(tree, idAccessor, childrenAccessor, { root1: true, mid: true })
    expect(flat.map((r) => ({ id: r.id, parentId: r.parentId }))).toEqual([
      { id: 'root1', parentId: null },
      { id: 'mid', parentId: 'root1' },
      { id: 'deep', parentId: 'mid' }
    ])
  })

  it('일부 폴더만 열려 있는 혼합 케이스', () => {
    const tree: TestNode[] = [
      {
        id: 'open',
        kind: 'folder',
        children: [{ id: 'a', kind: 'leaf' }]
      },
      {
        id: 'closed',
        kind: 'folder',
        children: [{ id: 'b', kind: 'leaf' }]
      }
    ]
    const flat = flattenTree(tree, idAccessor, childrenAccessor, { open: true })
    expect(flat.map((r) => r.id)).toEqual(['open', 'a', 'closed'])
  })

  it('빈 자식 배열을 가진 폴더는 isLeaf=false 지만 펼침 시 자식 없음', () => {
    const tree: TestNode[] = [{ id: 'empty', kind: 'folder', children: [] }]
    const flat = flattenTree(tree, idAccessor, childrenAccessor, { empty: true })
    expect(flat).toEqual([
      { data: tree[0], id: 'empty', level: 0, childIndex: 0, parentId: null, isLeaf: false }
    ])
  })

  it('빈 트리는 빈 결과', () => {
    expect(flattenTree<TestNode>([], idAccessor, childrenAccessor, {})).toEqual([])
  })
})
