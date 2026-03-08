import { updateSizesInLayout } from './layout'
import { GetState, SetState } from './types'

export const createLayoutActions = (
  set: SetState,
  get: GetState
): ReturnType<typeof createLayoutActions> => ({
  updateLayoutSizes: (nodeId: string, sizes: number[]): void => {
    const { layout } = get()
    set({ layout: updateSizesInLayout(layout, nodeId, sizes) })
  }
})
