/**
 * app/layout/model/use-tree-drag-monitor.test.ts
 *
 * useDndMonitor 콜백 4종 캡처 + useTreeDragStore 업데이트 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { DragStartEvent, DragEndEvent, DragCancelEvent } from '@dnd-kit/core'

const dnd = vi.hoisted(() => ({
  capture: {
    onDragStart: null as null | ((e: DragStartEvent) => void),
    onDragOver: null as null | ((e: { active: unknown; over: unknown }) => void),
    onDragEnd: null as null | ((e: DragEndEvent) => void),
    onDragCancel: null as null | ((e: DragCancelEvent) => void)
  }
}))

vi.mock('@dnd-kit/core', () => ({
  useDndMonitor: (opts: typeof dnd.capture) => {
    dnd.capture = { ...dnd.capture, ...opts }
  }
}))

import { useTreeDragStore } from '@shared/store/tree-drag.store'
import { useTreeDragMonitor } from '../use-tree-drag-monitor'

beforeEach(() => {
  useTreeDragStore.setState({
    isTreeDragActive: false,
    isFolderDrag: false,
    sourcePaneId: null,
    targetFolderId: null
  })
  dnd.capture.onDragStart = null
  dnd.capture.onDragOver = null
  dnd.capture.onDragEnd = null
  dnd.capture.onDragCancel = null
})

describe('useTreeDragMonitor', () => {
  it('onDragStart with source=tree-node → beginTreeDrag', () => {
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragStart?.({
      active: {
        data: {
          current: { source: 'tree-node', kind: 'folder', sourcePaneId: 'p1' }
        }
      }
    } as unknown as DragStartEvent)
    expect(useTreeDragStore.getState().isTreeDragActive).toBe(true)
    expect(useTreeDragStore.getState().isFolderDrag).toBe(true)
    expect(useTreeDragStore.getState().sourcePaneId).toBe('p1')
  })

  it('onDragStart 비-tree-node source → 무시', () => {
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragStart?.({
      active: { data: { current: { source: 'other' } } }
    } as unknown as DragStartEvent)
    expect(useTreeDragStore.getState().isTreeDragActive).toBe(false)
  })

  it('onDragOver: tree-into target → folderId 설정', () => {
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragOver?.({
      active: { data: { current: { source: 'tree-node' } } },
      over: { data: { current: { target: 'tree-into', folderId: 'f-1' } } }
    })
    expect(useTreeDragStore.getState().targetFolderId).toBe('f-1')
  })

  it('onDragOver: tree-position target → parentId 사용', () => {
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragOver?.({
      active: { data: { current: { source: 'tree-node' } } },
      over: { data: { current: { target: 'tree-position', parentId: 'f-2' } } }
    })
    expect(useTreeDragStore.getState().targetFolderId).toBe('f-2')
  })

  it('onDragOver: target 없음 → null', () => {
    useTreeDragStore.setState({ targetFolderId: 'old' })
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragOver?.({
      active: { data: { current: { source: 'tree-node' } } },
      over: null
    })
    expect(useTreeDragStore.getState().targetFolderId).toBe(null)
  })

  it('onDragOver: source 가 tree-node 아니면 무시', () => {
    useTreeDragStore.setState({ targetFolderId: 'keep' })
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragOver?.({
      active: { data: { current: { source: 'other' } } },
      over: { data: { current: { target: 'tree-into', folderId: 'f' } } }
    })
    expect(useTreeDragStore.getState().targetFolderId).toBe('keep')
  })

  it('onDragEnd → endTreeDrag', () => {
    useTreeDragStore.setState({
      isTreeDragActive: true,
      isFolderDrag: false,
      sourcePaneId: 'p'
    })
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragEnd?.({} as unknown as DragEndEvent)
    expect(useTreeDragStore.getState().isTreeDragActive).toBe(false)
    expect(useTreeDragStore.getState().sourcePaneId).toBe(null)
  })

  it('onDragCancel → endTreeDrag', () => {
    useTreeDragStore.setState({ isTreeDragActive: true })
    renderHook(() => useTreeDragMonitor())
    dnd.capture.onDragCancel?.({} as unknown as DragCancelEvent)
    expect(useTreeDragStore.getState().isTreeDragActive).toBe(false)
  })
})
