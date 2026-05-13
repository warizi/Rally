/**
 * MCP reminder tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_reminders, manage_reminders.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const reminderTools: ToolDefinition[] = [
  {
    name: 'list_reminders',
    deprecated: {
      replacedBy: 'read_tasks',
      since: 'v2.0',
      reason: "read_tasks({ types: ['reminder'], entityType, entityId, pendingOnly })"
    },
    description: `List reminders. If entityType+entityId are given, returns reminders only for that entity; otherwise returns reminders for all todos and schedules in the active workspace.
pendingOnly=true filters out fired reminders.`,
    schema: {
      entityType: z
        .enum(['todo', 'schedule'])
        .optional()
        .describe('Required together with entityId to scope by entity'),
      entityId: z.string().optional(),
      pendingOnly: z.boolean().optional().describe('Only un-fired reminders (default: false)')
    },
    handler: ({ entityType, entityId, pendingOnly }) => {
      const params = new URLSearchParams()
      if (entityType) params.set('entityType', entityType as string)
      if (entityId) params.set('entityId', entityId as string)
      if (pendingOnly) params.set('pendingOnly', 'true')
      const qs = params.toString()
      return callTool('GET', `/api/mcp/reminders${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_reminders',
    deprecated: {
      replacedBy: 'manage_tasks',
      since: 'v2.0',
      reason: "manage_tasks with type: 'reminder' (action: 'create'|'delete'). update unsupported in both."
    },
    description: `Create or delete reminders for todos/schedules.
offsetMs (create) must be one of: 600000 (10m), 1800000 (30m), 3600000 (1h), 86400000 (1d), 172800000 (2d).
Reminder fires (entity start/due time - offsetMs); creation throws if that moment is in the past.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              entityType: z.enum(['todo', 'schedule']),
              entityId: z.string(),
              offsetMs: z.number().int().positive()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of reminder actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/reminders/batch', args)
  }
  // ─── Recurring rules ──────────────────────────────────────
]
