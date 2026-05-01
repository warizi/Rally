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

export type TrashRetentionKey = '1' | '7' | '30' | '90' | '365' | 'never'

export interface TrashBatchSummary {
  id: string
  workspaceId: string
  rootEntityType: TrashEntityKind
  rootEntityId: string
  rootTitle: string
  childCount: number
  /** ISO 8601 string */
  deletedAt: string
  reason: string | null
}

export interface TrashListResult {
  batches: TrashBatchSummary[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export const TRASH_RETENTION_OPTIONS: Array<{ value: TrashRetentionKey; label: string }> = [
  { value: '1', label: '1일' },
  { value: '7', label: '1주' },
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
  { value: '365', label: '1년' },
  { value: 'never', label: '안 함 (수동 관리)' }
]

const KIND_LABEL: Record<TrashEntityKind, string> = {
  folder: '폴더',
  note: '노트',
  csv: '표',
  pdf: 'PDF',
  image: '이미지',
  canvas: '캔버스',
  todo: '할 일',
  schedule: '일정',
  recurring_rule: '반복 규칙',
  template: '템플릿'
}

export function trashKindLabel(kind: TrashEntityKind): string {
  return KIND_LABEL[kind] ?? kind
}
