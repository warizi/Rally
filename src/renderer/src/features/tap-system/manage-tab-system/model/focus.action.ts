import { GetState, SetState } from './types'

export const createFocusActions = (
  set: SetState,
  get: GetState
): ReturnType<typeof createFocusActions> => ({
  // 스택에 push. 이미 있던 항목이면 기존 위치에서 제거 후 top 으로 올린다.
  enterFocusMode: (tabId: string): void => {
    if (!get().tabs[tabId]) return
    set((state) => ({
      focusedTabIds: [...state.focusedTabIds.filter((id) => id !== tabId), tabId]
    }))
  },

  // 스택 top 한 칸 pop. 비어있으면 무동작.
  exitFocusMode: (): void => {
    const { focusedTabIds } = get()
    if (focusedTabIds.length === 0) return
    set({ focusedTabIds: focusedTabIds.slice(0, -1) })
  }
})
