/**
 * MCP workspace tools.
 * P3-7 — tool-definitions.ts 분할. 포함: get_workspace_info.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const workspaceTools: ToolDefinition[] = [
  {
    name: 'get_workspace_info',
    description: `Active workspace summary: id/name/path + cross-domain stats + recentActivity (note/table/canvas/todo, updatedAt desc).
Use this when you want a quick overview of the workspace without paging through list_items.

Lightweight stats-only mode: pass statsTypes (subset of count kinds) to skip recentActivity and return just the requested counts. Useful when you only need totals.`,
    schema: {
      recentLimit: z
        .number()
        .int()
        .min(0)
        .max(50)
        .optional()
        .describe(
          'Number of recent activity entries (default: 10, max: 50). Ignored when statsTypes is set.'
        ),
      statsTypes: z
        .array(
          z.enum([
            'folders',
            'notes',
            'tables',
            'canvases',
            'todos',
            'pdfs',
            'images',
            'schedules',
            'tags',
            'templates',
            'recurringRules'
          ])
        )
        .optional()
        .describe(
          'When set, returns lightweight count-only stats for these kinds (no recentActivity). Pass [] not allowed — omit instead.'
        )
    },
    handler: ({ recentLimit, statsTypes }) => {
      if (Array.isArray(statsTypes) && statsTypes.length > 0) {
        const params = new URLSearchParams()
        for (const t of statsTypes as string[]) params.append('types[]', t)
        return callTool('GET', `/api/mcp/workspace/stats?${params.toString()}`)
      }
      const params = new URLSearchParams()
      if (typeof recentLimit === 'number') params.set('recentLimit', String(recentLimit))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/workspace${qs ? `?${qs}` : ''}`)
    }
  }
  // ─── Trash ────────────────────────────────────────────────
]
