/**
 * MCP workspace tools.
 * P3-7 — tool-definitions.ts 분할. 포함: get_workspace_info.
 * MCP v2 — read_workspace 추가 (get_workspace_info + statsTypes mode 통합).
 * MCP v2 — manage_workspace 추가 (list + switch action).
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const workspaceTools: ToolDefinition[] = [
  {
    name: 'read_workspace',
    description: `Read active workspace info — replaces v1 get_workspace_info.

mode:
- 'full' (default): id/name/path + stats + recentActivity. Use recentLimit for activity cap.
- 'stats': lightweight — only requested statsTypes counts, no recentActivity.
- 'recent': same endpoint as 'full' currently; client focuses on recentActivity field.`,
    schema: {
      mode: z.enum(['full', 'stats', 'recent']).optional().describe('View mode (default: full)'),
      recentLimit: z
        .number()
        .int()
        .min(0)
        .max(50)
        .optional()
        .describe('Recent activity entries (default 10, max 50). Ignored when mode=stats.'),
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
        .describe('Stats kinds. Required when mode=stats. Otherwise ignored.')
    },
    handler: ({ mode, recentLimit, statsTypes }) => {
      const resolvedMode = (mode as string | undefined) ?? 'full'
      if (resolvedMode === 'stats') {
        const params = new URLSearchParams()
        if (Array.isArray(statsTypes)) {
          for (const t of statsTypes as string[]) params.append('types[]', t)
        }
        return callTool('GET', `/api/mcp/workspace/stats?${params.toString()}`)
      }
      const params = new URLSearchParams()
      if (typeof recentLimit === 'number') params.set('recentLimit', String(recentLimit))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/workspace${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_workspace',
    description: `Manage workspaces — list all workspaces or switch the active one.

actions:
- 'list': return all workspaces with { id, name, path, active }. workspaceId is ignored.
- 'switch': switch the active workspace. Requires workspaceId.
            Updates both the MCP context (subsequent calls operate on the new workspace)
            and the Rally app UI (running app's current workspace updates via IPC).
            Same-workspace switch is a no-op and returns alreadyActive:true.`,
    schema: {
      action: z.enum(['list', 'switch']).describe("Action to perform: 'list' | 'switch'"),
      workspaceId: z
        .string()
        .min(1)
        .optional()
        .describe("Target workspace id — required when action='switch', ignored for 'list'")
    },
    handler: ({ action, workspaceId }) => {
      if (action === 'list') {
        return callTool('GET', '/api/mcp/workspaces')
      }
      if (action === 'switch') {
        if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
          return Promise.resolve({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: "workspaceId is required when action='switch'" })
              }
            ],
            isError: true
          })
        }
        return callTool('POST', '/api/mcp/workspace/switch', { workspaceId })
      }
      return Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Unknown action: ${String(action)}` })
          }
        ],
        isError: true
      })
    }
  }
]
