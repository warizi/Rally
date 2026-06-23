import { BrowserWindow } from 'electron'
import type { Actor } from '../../services/_shared/actor'

/**
 * MCP 활동(activity) 알림 파이프라인.
 *
 * 기존 broadcastChanged 는 "캐시 무효화 신호"(채널별 *:changed)만 담당한다.
 * MCP 로 들어온 조작을 사용자에게 알리는 토스트는 파일 워처와 분리해
 * 이 전용 채널(`mcp:activity`)로 발행한다.
 *
 * - 라우트 핸들러가 `context.recordActivity()` 로 수행 내역을 보고하고
 * - router.handle() 이 요청 성공 후 모인 record 를 한 번에 flush 한다 (배치 묶음).
 *
 * payload 에 항목 메타(id·title·type)를 직접 실어 보내므로, 렌더러가
 * 캐시를 조회하지 않고도 토스트를 만들 수 있다 (생성/삭제 stale-cache 미노출 해소).
 */

/** 토스트 클릭 시 열 수 있는 단일 항목 */
export interface McpActivityItem {
  /** 도메인 타입 (아이콘·라우팅용) */
  type: McpActivityDomain
  id: string
  title: string
  /** 파일 도메인의 relativePath (선택) */
  path?: string
}

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

/** 한 라우트가 보고하는 단위 활동 (도메인 × 동작) */
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

/** 라우트가 활동을 모으는 수집기 (요청당 1개) */
export interface ActivityCollector {
  record: (record: McpActivityRecord) => void
  drain: () => McpActivityRecord[]
}

export function createActivityCollector(): ActivityCollector {
  const records: McpActivityRecord[] = []
  return {
    record: (record) => {
      // 빈 items 는 토스트 가치가 없으므로 버린다
      if (record.items.length > 0) records.push(record)
    },
    drain: () => records.splice(0)
  }
}

/** 모인 활동을 모든 렌더러 윈도우로 발행한다 (mcp:activity). */
export function emitMcpActivity(
  workspaceId: string | null,
  actor: Actor,
  records: McpActivityRecord[]
): void {
  if (records.length === 0) return
  const payload: McpActivityPayload = {
    workspaceId,
    actor: { kind: actor.kind, id: actor.id ?? null },
    records
  }
  // 알림 발행 실패(윈도우 없음 등)가 MCP 요청 자체를 실패시키면 안 된다.
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('mcp:activity', payload)
    })
  } catch {
    // 토스트 알림은 부가 기능 — 발행 실패는 무시
  }
}
