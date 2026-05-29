/**
 * app/layout/model/use-history-link-to-tab-listener.test.ts
 *
 * 히스토리 링크 → 탭 드롭. tree-to-tab 과 동일한 라우팅 규칙, source 만 다름.
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
import { useHistoryLinkToTabListener } from '../use-history-link-to-tab-listener'

const MAIN = 'main'

beforeEach(() => {
  useTabStore.getState().reset()
  dndCapture.onDragEnd = null
})

function fire(activeData: unknown, overId: string | null): void {
  dndCapture.onDragEnd?.({
    active: { data: { current: activeData } },
    over: overId ? { id: overId } : null
  } as unknown as DragEndEvent)
}

function newTabs(): { id: string; pathname: string; type: string }[] {
  return Object.values(useTabStore.getState().tabs)
    .filter((t) => t.id !== 'tab-dashboard')
    .map((t) => ({ id: t.id, pathname: t.pathname, type: t.type as string }))
}

describe('useHistoryLinkToTabListener', () => {
  it('source 가 history-link 가 아니면 무시', () => {
    renderHook(() => useHistoryLinkToTabListener())
    fire({ source: 'other', link: { type: 'note', id: 'n-1', title: 'X' } }, `pane:${MAIN}`)
    expect(newTabs()).toEqual([])
  })

  it('over 없으면 무시', () => {
    renderHook(() => useHistoryLinkToTabListener())
    fire({ source: 'history-link', link: { type: 'note', id: 'n-1', title: 'X' } }, null)
    expect(newTabs()).toEqual([])
  })

  it('linkToTabOptions 가 null 반환 (지원하지 않는 type) → 무시', () => {
    renderHook(() => useHistoryLinkToTabListener())
    fire(
      { source: 'history-link', link: { type: 'unknown-type', id: 'x', title: 'X' } },
      `pane:${MAIN}`
    )
    expect(newTabs()).toEqual([])
  })

  it('tab-list:{paneId} → openTab', () => {
    renderHook(() => useHistoryLinkToTabListener())
    fire(
      { source: 'history-link', link: { type: 'note', id: 'n-1', title: 'N' } },
      `tab-list:${MAIN}`
    )
    expect(newTabs()[0].pathname).toBe('/folder/note/n-1')
  })

  it('canvas link → /canvas/:id 경로', () => {
    renderHook(() => useHistoryLinkToTabListener())
    fire(
      { source: 'history-link', link: { type: 'canvas', id: 'cv-1', title: 'Canvas' } },
      `pane:${MAIN}`
    )
    const tab = newTabs()[0]
    expect(tab.pathname).toBe('/canvas/cv-1')
    expect(tab.type).toBe('canvas-detail')
  })

  it('split-zone → openTabInNewSplit → 새 pane', () => {
    renderHook(() => useHistoryLinkToTabListener())
    const before = Object.keys(useTabStore.getState().panes).length
    fire(
      { source: 'history-link', link: { type: 'csv', id: 'c-1', title: 'C' } },
      `split-zone:${MAIN}:bottom`
    )
    expect(Object.keys(useTabStore.getState().panes).length).toBe(before + 1)
  })

  it('split-zone parts 잘못 → 무시', () => {
    renderHook(() => useHistoryLinkToTabListener())
    const before = Object.keys(useTabStore.getState().panes).length
    fire(
      { source: 'history-link', link: { type: 'note', id: 'n-x', title: 'X' } },
      `split-zone:${MAIN}`
    )
    expect(Object.keys(useTabStore.getState().panes).length).toBe(before)
  })

  it('알 수 없는 position → 무시', () => {
    renderHook(() => useHistoryLinkToTabListener())
    const before = Object.keys(useTabStore.getState().panes).length
    fire(
      { source: 'history-link', link: { type: 'note', id: 'n-x', title: 'X' } },
      `split-zone:${MAIN}:unknown`
    )
    expect(Object.keys(useTabStore.getState().panes).length).toBe(before)
  })
})
