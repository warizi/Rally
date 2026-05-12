/**
 * MCP tool 정의 공용 타입.
 * P3-7 — tool-definitions.ts (1,031L) 도메인 분할.
 */
import type { z } from 'zod'
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'

export type ToolSchema = Record<string, z.ZodType>

export interface ToolDefinition {
  name: string
  description: string
  schema: ToolSchema
  handler: ToolCallback<ToolSchema>
}

/** URL encode helper (encodeURIComponent alias). */
export const e = encodeURIComponent
