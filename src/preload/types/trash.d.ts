import type { IpcResponse } from './common'

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
export type TrashRetentionKey = '1' | '7' | '30' | '90' | '365' | 'never'

export interface TrashBatchSummary {
  id: string
  workspaceId: string
  rootEntityType: TrashEntityKind
  rootEntityId: string
  rootTitle: string
  childCount: number
  deletedAt: string
  reason: string | null
}

export interface TrashListResult {
  batches: TrashBatchSummary[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export interface TrashAPI {
  list: (
    workspaceId: string,
    options?: {
      types?: TrashEntityKind[]
      search?: string
      offset?: number
      limit?: number
    }
  ) => Promise<IpcResponse<TrashListResult>>
  count: (workspaceId: string) => Promise<IpcResponse<number>>
  restore: (
    workspaceId: string,
    batchId: string
  ) => Promise<
    IpcResponse<{
      restored: { type: TrashEntityKind; id: string; title: string }[]
      conflicts?: { id: string; reason: string }[]
    }>
  >
  purge: (workspaceId: string, batchId: string) => Promise<IpcResponse<{ success: boolean }>>
  emptyAll: (workspaceId: string) => Promise<IpcResponse<{ purgedBatchIds: string[] }>>
  softRemove: (
    workspaceId: string,
    entityType: TrashEntityKind,
    entityId: string
  ) => Promise<IpcResponse<{ batchId: string }>>
  getRetention: () => Promise<IpcResponse<TrashRetentionKey>>
  setRetention: (value: TrashRetentionKey) => Promise<IpcResponse<{ value: TrashRetentionKey }>>
  sweepNow: () => Promise<IpcResponse<{ purged: number }>>
  onChanged: (cb: (workspaceId: string) => void) => () => void
}
