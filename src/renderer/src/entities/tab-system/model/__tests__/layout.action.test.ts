/**
 * entities/tab-system/model/layout.action.test.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { createLayoutActions } from '../layout.action'
import type { LayoutNode } from '../types'

vi.mock('../layout', () => ({
  updateSizesInLayout: (layout: LayoutNode, nodeId: string, sizes: number[]) => ({
    ...layout,
    _updated: { nodeId, sizes }
  })
}))

describe('createLayoutActions', () => {
  it('updateLayoutSizes → set 호출 with 새 layout', () => {
    const initialLayout = {
      id: 'root',
      type: 'split',
      direction: 'horizontal',
      sizes: [50, 50],
      children: []
    } as unknown as LayoutNode

    let storedLayout = initialLayout
    const set = vi.fn((updater) => {
      storedLayout = updater.layout
    })
    const get = vi.fn(() => ({ layout: initialLayout })) as unknown as Parameters<
      typeof createLayoutActions
    >[1]

    const actions = createLayoutActions(
      set as unknown as Parameters<typeof createLayoutActions>[0],
      get
    )
    actions.updateLayoutSizes('root', [60, 40])

    expect(set).toHaveBeenCalled()
    expect((storedLayout as unknown as { _updated: unknown })._updated).toEqual({
      nodeId: 'root',
      sizes: [60, 40]
    })
  })
})
