/**
 * MCP history tools.
 * P3-7 — tool-definitions.ts 분할. 포함: get_history.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const historyTools: ToolDefinition[] = [
  {
    name: 'get_history',
    deprecated: {
      replacedBy: 'read_tasks',
      since: 'v2.0',
      reason: "read_tasks({ mode: 'completed', dayLimit, fromDate, toDate, query })"
    },
    description: `List completed todos grouped by day (most recent first). Includes recurring completions too.
Pagination is by "day with activity" — dayOffset/dayLimit skip empty days. Use fromDate/toDate to constrain by absolute range.
query: case-insensitive substring on todo titles or linked file titles.`,
    schema: {
      dayOffset: z.number().int().min(0).optional().describe('Pagination offset in active days'),
      dayLimit: z.number().int().min(1).max(60).optional().describe('Days per page (default: 10)'),
      fromDate: z.string().optional().describe('YYYY-MM-DD inclusive lower bound'),
      toDate: z.string().optional().describe('YYYY-MM-DD inclusive upper bound'),
      query: z.string().optional()
    },
    handler: ({ dayOffset, dayLimit, fromDate, toDate, query }) => {
      const params = new URLSearchParams()
      if (typeof dayOffset === 'number') params.set('dayOffset', String(dayOffset))
      if (typeof dayLimit === 'number') params.set('dayLimit', String(dayLimit))
      if (fromDate) params.set('fromDate', fromDate as string)
      if (toDate) params.set('toDate', toDate as string)
      if (typeof query === 'string' && query.trim()) params.set('query', query)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/history${qs ? `?${qs}` : ''}`)
    }
  }
  // ─── PDFs / Images ────────────────────────────────────────
]
