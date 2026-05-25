/**
 * 휴지통 공개 도메인 타입.
 *
 * 다른 모듈(handlers, ipc, mcp) 이 import 해서 사용. cascade-collector 도
 * 도메인 dispatch 시 본 타입을 참조.
 */

export type TrashEntityKind =
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'canvas'
  | 'todo'
  | 'schedule'
  | 'recurring_rule'
  | 'template'
  | 'custom_skill'

export const SUPPORTED_KINDS: ReadonlySet<TrashEntityKind> = new Set([
  'canvas',
  'todo',
  'schedule',
  'recurring_rule',
  'note',
  'csv',
  'pdf',
  'image',
  'folder',
  'template',
  'custom_skill'
])

export interface TrashBatchSummary {
  id: string
  workspaceId: string
  rootEntityType: TrashEntityKind
  rootEntityId: string
  rootTitle: string
  childCount: number
  deletedAt: Date
  reason: string | null
}

export interface TrashListOptions {
  types?: TrashEntityKind[]
  search?: string
  offset?: number
  limit?: number
}

export interface TrashListResult {
  batches: TrashBatchSummary[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export interface SoftRemoveOptions {
  reason?: 'user_action' | 'mcp' | 'auto_sweep_pending'
}

// ─── 자동 비우기 설정 ────────────────────────────────────────

export type TrashRetentionKey = '1' | '7' | '30' | '90' | '365' | 'never'

export const RETENTION_DAYS: Record<TrashRetentionKey, number | null> = {
  '1': 1,
  '7': 7,
  '30': 30,
  '90': 90,
  '365': 365,
  never: null
}

export const SETTINGS_KEY = 'trash.autoEmptyDays'
export const DEFAULT_RETENTION: TrashRetentionKey = '30'

export function isValidRetention(v: string): v is TrashRetentionKey {
  return v in RETENTION_DAYS
}
