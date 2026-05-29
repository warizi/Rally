/**
 * widgets/history-timeline/lib/history-link-drag.test.ts
 */
import { describe, it, expect } from 'vitest'
import { buildHistoryLinkDragId, HISTORY_LINK_DRAG_PREFIX } from '../history-link-drag'
import type { HistoryLink } from '@entities/history'

describe('history-link-drag', () => {
  it('buildHistoryLinkDragId → prefix:type:id', () => {
    const link = { type: 'note', id: 'n1', title: 'A' } as HistoryLink
    expect(buildHistoryLinkDragId(link)).toBe('history-link:note:n1')
  })

  it('HISTORY_LINK_DRAG_PREFIX 상수', () => {
    expect(HISTORY_LINK_DRAG_PREFIX).toBe('history-link:')
  })

  it('canvas type → drag id', () => {
    const link = { type: 'canvas', id: 'cv1', title: 'X' } as HistoryLink
    expect(buildHistoryLinkDragId(link)).toBe('history-link:canvas:cv1')
  })
})
