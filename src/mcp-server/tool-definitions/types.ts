/**
 * MCP tool 정의 공용 타입.
 * P3-7 — tool-definitions.ts (1,031L) 도메인 분할.
 * MCP v2 — `deprecated` 필드 추가 (v1→v2 alias 인프라).
 */
import type { z } from 'zod'
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'

export type ToolSchema = Record<string, z.ZodType>

/**
 * v2 마이그레이션 메타. tool 이 deprecated 인 경우 채워두면
 * registerAllTools 가 description 에 `[DEPRECATED]` banner 를 자동 부착하고
 * 응답 payload 에 `_deprecation` 메타를 자동 주입한다.
 */
export interface DeprecationInfo {
  /** 이 도구를 대체하는 v2 tool 이름. */
  replacedBy: string
  /** 마이그레이션 힌트 / 사유. AI 클라이언트에게 보이는 메시지. */
  reason?: string
  /** deprecate 된 버전 (예: 'v2.0'). */
  since?: string
}

export interface ToolDefinition {
  name: string
  description: string
  schema: ToolSchema
  handler: ToolCallback<ToolSchema>
  /**
   * v2 마이그레이션: deprecated 표시. 미설정 시 정상 도구로 동작.
   * registerAllTools 가 description prefix + 응답 메타 주입을 처리한다.
   */
  deprecated?: DeprecationInfo
}

/** URL encode helper (encodeURIComponent alias). */
export const e = encodeURIComponent
