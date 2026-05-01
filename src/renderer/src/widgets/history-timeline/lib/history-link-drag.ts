import type { HistoryLink } from '@entities/history'

export const HISTORY_LINK_DRAG_PREFIX = 'history-link:' as const

export interface HistoryLinkDragData {
  source: 'history-link'
  link: HistoryLink
}

export function buildHistoryLinkDragId(link: HistoryLink): string {
  return `${HISTORY_LINK_DRAG_PREFIX}${link.type}:${link.id}`
}
