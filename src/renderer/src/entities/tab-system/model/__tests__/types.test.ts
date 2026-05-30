/**
 * entities/tab-system/model/types.test.ts
 *
 * 타입 가드: isPaneNode, isSplitContainerNode
 */
import { describe, it, expect } from 'vitest'
import { isPaneNode, isSplitContainerNode } from '../types'
import type { LayoutNode } from '../types'

describe('isPaneNode', () => {
  it('pane node → true', () => {
    const node = { id: 'p1', type: 'pane', paneId: 'main' } as unknown as LayoutNode
    expect(isPaneNode(node)).toBe(true)
  })

  it('split node → false', () => {
    const node = {
      id: 's1',
      type: 'split',
      direction: 'horizontal',
      sizes: [1, 1],
      children: []
    } as unknown as LayoutNode
    expect(isPaneNode(node)).toBe(false)
  })
})

describe('isSplitContainerNode', () => {
  it('split node → true', () => {
    const node = {
      id: 's1',
      type: 'split',
      direction: 'horizontal',
      sizes: [1, 1],
      children: []
    } as unknown as LayoutNode
    expect(isSplitContainerNode(node)).toBe(true)
  })

  it('pane node → false', () => {
    const node = { id: 'p1', type: 'pane', paneId: 'main' } as unknown as LayoutNode
    expect(isSplitContainerNode(node)).toBe(false)
  })
})
