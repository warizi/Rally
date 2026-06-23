/**
 * MCP 활동 알림 채널(`mcp:activity`) 타입.
 * main 의 `src/main/mcp-api/lib/activity.ts` 와 형태를 일치시킨다 (수동 동기화).
 */

export type McpActivityDomain =
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'folder'
  | 'canvas'
  | 'todo'
  | 'schedule'
  | 'recurring-rule'
  | 'recurring-completion'
  | 'reminder'
  | 'tag'
  | 'template'
  | 'link'
  | 'workspace'
  | 'trash'

export type McpActivityOperation =
  | 'create'
  | 'update'
  | 'rename'
  | 'move'
  | 'delete'
  | 'restore'
  | 'purge'
  | 'empty'
  | 'link'
  | 'unlink'
  | 'attach'
  | 'detach'
  | 'complete'
  | 'uncomplete'
  | 'switch'

export interface McpActivityItem {
  type: McpActivityDomain
  id: string
  title: string
  path?: string
}

export interface McpActivityRecord {
  domain: McpActivityDomain
  operation: McpActivityOperation
  items: McpActivityItem[]
}

export interface McpActivityPayload {
  workspaceId: string | null
  actor: { kind: 'user' | 'ai'; id: string | null }
  records: McpActivityRecord[]
}

export interface McpActivityAPI {
  onActivity: (callback: (payload: McpActivityPayload) => void) => () => void
}
