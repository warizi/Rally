/**
 * shared/types/tree-drag.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  TREE_NODE_DRAG_PREFIX,
  TREE_BEFORE_PREFIX,
  TREE_AFTER_PREFIX,
  TREE_INTO_PREFIX,
  isTreeNodeDragId
} from '../tree-drag'

describe('TREE prefix 상수', () => {
  it('네 가지 prefix 값', () => {
    expect(TREE_NODE_DRAG_PREFIX).toBe('tree-node:')
    expect(TREE_BEFORE_PREFIX).toBe('tree-before:')
    expect(TREE_AFTER_PREFIX).toBe('tree-after:')
    expect(TREE_INTO_PREFIX).toBe('tree-into:')
  })

  it('prefix 들이 서로 다름', () => {
    const set = new Set([
      TREE_NODE_DRAG_PREFIX,
      TREE_BEFORE_PREFIX,
      TREE_AFTER_PREFIX,
      TREE_INTO_PREFIX
    ])
    expect(set.size).toBe(4)
  })
})

describe('isTreeNodeDragId', () => {
  it('tree-node: prefix 인 경우 true', () => {
    expect(isTreeNodeDragId('tree-node:abc')).toBe(true)
    expect(isTreeNodeDragId(`${TREE_NODE_DRAG_PREFIX}123`)).toBe(true)
  })

  it('다른 prefix 또는 prefix 없는 경우 false', () => {
    expect(isTreeNodeDragId('tree-before:abc')).toBe(false)
    expect(isTreeNodeDragId('tree-after:abc')).toBe(false)
    expect(isTreeNodeDragId('tree-into:abc')).toBe(false)
    expect(isTreeNodeDragId('abc')).toBe(false)
    expect(isTreeNodeDragId('')).toBe(false)
  })
})
