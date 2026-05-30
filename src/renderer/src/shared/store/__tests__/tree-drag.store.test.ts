/**
 * shared/store/tree-drag.store.test.ts
 *
 * useTreeDragStore actions: beginTreeDrag / setTargetFolderId / endTreeDrag.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTreeDragStore } from '../tree-drag.store'

beforeEach(() => {
  useTreeDragStore.getState().endTreeDrag()
})

describe('useTreeDragStore', () => {
  it('초기 상태', () => {
    const state = useTreeDragStore.getState()
    expect(state.isTreeDragActive).toBe(false)
    expect(state.isFolderDrag).toBe(false)
    expect(state.sourcePaneId).toBeNull()
    expect(state.targetFolderId).toBeNull()
  })

  it('beginTreeDrag (folder=true) → isTreeDragActive=true + isFolderDrag=true', () => {
    useTreeDragStore.getState().beginTreeDrag({ isFolder: true, sourcePaneId: 'p1' })
    const state = useTreeDragStore.getState()
    expect(state.isTreeDragActive).toBe(true)
    expect(state.isFolderDrag).toBe(true)
    expect(state.sourcePaneId).toBe('p1')
    expect(state.targetFolderId).toBeNull()
  })

  it('beginTreeDrag (folder=false) → isFolderDrag=false', () => {
    useTreeDragStore.getState().beginTreeDrag({ isFolder: false, sourcePaneId: 'p1' })
    expect(useTreeDragStore.getState().isFolderDrag).toBe(false)
    expect(useTreeDragStore.getState().isTreeDragActive).toBe(true)
  })

  it('setTargetFolderId → targetFolderId 변경', () => {
    useTreeDragStore.getState().beginTreeDrag({ isFolder: true, sourcePaneId: 'p1' })
    useTreeDragStore.getState().setTargetFolderId('folder-1')
    expect(useTreeDragStore.getState().targetFolderId).toBe('folder-1')
  })

  it('setTargetFolderId(null) → 해제', () => {
    useTreeDragStore.getState().setTargetFolderId('folder-x')
    useTreeDragStore.getState().setTargetFolderId(null)
    expect(useTreeDragStore.getState().targetFolderId).toBeNull()
  })

  it('endTreeDrag → 모든 상태 초기화', () => {
    useTreeDragStore.getState().beginTreeDrag({ isFolder: true, sourcePaneId: 'p1' })
    useTreeDragStore.getState().setTargetFolderId('folder-1')
    useTreeDragStore.getState().endTreeDrag()
    const state = useTreeDragStore.getState()
    expect(state.isTreeDragActive).toBe(false)
    expect(state.isFolderDrag).toBe(false)
    expect(state.sourcePaneId).toBeNull()
    expect(state.targetFolderId).toBeNull()
  })
})
