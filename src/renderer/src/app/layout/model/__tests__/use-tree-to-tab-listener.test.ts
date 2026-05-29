/**
 * app/layout/model/use-tree-to-tab-listener.test.ts
 *
 * 트리 노드 → 탭 드롭 listener. useDndMonitor 를 모킹해 onDragEnd 핸들러를
 * 캡처한 다음, 다양한 over.id 조합으로 호출해 분기를 검증한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { DragEndEvent } from '@dnd-kit/core'

const { dndCapture } = vi.hoisted(() => ({
  dndCapture: { onDragEnd: null as null | ((e: DragEndEvent) => void) }
}))

vi.mock('@dnd-kit/core', () => ({
  useDndMonitor: (handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
    dndCapture.onDragEnd = handlers.onDragEnd ?? null
  }
}))

import { useTabStore } from '@/entities/tab-system'
import { useTreeToTabListener } from '../use-tree-to-tab-listener'

const MAIN = 'main'

beforeEach(() => {
  useTabStore.getState().reset()
  dndCapture.onDragEnd = null
})

function newlyOpenedTabs(): { id: string; pathname: string; type: string }[] {
  return Object.values(useTabStore.getState().tabs)
    .filter((t) => t.id !== 'tab-dashboard')
    .map((t) => ({ id: t.id, pathname: t.pathname, type: t.type as string }))
}

function fire(activeData: unknown, overId: string | null): void {
  dndCapture.onDragEnd?.({
    active: { data: { current: activeData } },
    over: overId ? { id: overId } : null
  } as unknown as DragEndEvent)
}

function trigger(): void {
  renderHook(() => useTreeToTabListener())
}

describe('useTreeToTabListener', () => {
  it('source 가 tree-node 가 아니면 무시', () => {
    trigger()
    fire({ source: 'other', kind: 'note', id: 'n-1', title: 'X' }, `pane:${MAIN}`)
    expect(newlyOpenedTabs()).toEqual([])
  })

  it('kind=folder 는 탭 오픈 대상 제외', () => {
    trigger()
    fire({ source: 'tree-node', kind: 'folder', id: 'f-1', title: 'F' }, `pane:${MAIN}`)
    expect(newlyOpenedTabs()).toEqual([])
  })

  it('over 없으면 무시', () => {
    trigger()
    fire({ source: 'tree-node', kind: 'note', id: 'n-1', title: 'N' }, null)
    expect(newlyOpenedTabs()).toEqual([])
  })

  it('tab-list:{paneId} → openTab 으로 새 탭', () => {
    trigger()
    fire({ source: 'tree-node', kind: 'note', id: 'n-1', title: 'N' }, `tab-list:${MAIN}`)
    const tabs = newlyOpenedTabs()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].pathname).toBe('/folder/note/n-1')
  })

  it('pane:{paneId} → openTab 으로 새 탭', () => {
    trigger()
    fire({ source: 'tree-node', kind: 'csv', id: 'c-1', title: 'C' }, `pane:${MAIN}`)
    expect(newlyOpenedTabs()[0].pathname).toBe('/folder/csv/c-1')
  })

  it('split-zone:{paneId}:{position} → openTabInNewSplit → 새 pane 생성', () => {
    trigger()
    const before = Object.keys(useTabStore.getState().panes).length
    fire({ source: 'tree-node', kind: 'note', id: 'n-2', title: 'N2' }, `split-zone:${MAIN}:right`)
    expect(Object.keys(useTabStore.getState().panes).length).toBe(before + 1)
  })

  it('split-zone parts 잘못된 길이 → 무시', () => {
    trigger()
    const before = Object.keys(useTabStore.getState().panes).length
    fire({ source: 'tree-node', kind: 'note', id: 'n-3', title: 'N3' }, `split-zone:${MAIN}`)
    expect(Object.keys(useTabStore.getState().panes).length).toBe(before)
  })

  it('알 수 없는 position → 무시', () => {
    trigger()
    const before = Object.keys(useTabStore.getState().panes).length
    fire(
      { source: 'tree-node', kind: 'note', id: 'n-4', title: 'N4' },
      `split-zone:${MAIN}:diagonal`
    )
    expect(Object.keys(useTabStore.getState().panes).length).toBe(before)
  })

  it('같은 pathname 가 다른 pane 에 있으면 기존 탭 닫고 새 위치에 연다', () => {
    // pre-condition: main pane 에 이미 같은 노트 열림
    useTabStore.getState().openTab({ type: 'note', pathname: '/folder/note/n-1', title: 'N' })

    trigger()
    const splitPaneId = useTabStore.getState().splitPane(MAIN, 'right')
    fire({ source: 'tree-node', kind: 'note', id: 'n-1', title: 'N' }, `pane:${splitPaneId}`)

    const allTabs = Object.values(useTabStore.getState().tabs).filter(
      (t) => t.pathname === '/folder/note/n-1'
    )
    expect(allTabs).toHaveLength(1)
    expect(useTabStore.getState().panes[splitPaneId].tabIds).toHaveLength(1)
  })
})
