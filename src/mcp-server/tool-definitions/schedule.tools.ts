/**
 * MCP schedule tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_schedules, manage_schedules.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const scheduleTools: ToolDefinition[] = [
  {
    name: 'list_schedules',
    description: `List calendar events (schedules) in the active workspace.
- from/to: ISO 8601 date range. If both omitted, returns all schedules.
- search: substring match on title/description/location (case-insensitive)`,
    schema: {
      from: z.string().optional().describe('ISO 8601 start of range'),
      to: z.string().optional().describe('ISO 8601 end of range'),
      search: z.string().optional().describe('Substring match on title/description/location')
    },
    handler: ({ from, to, search }) => {
      const params = new URLSearchParams()
      if (from) params.set('from', from as string)
      if (to) params.set('to', to as string)
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/schedules${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_schedules',
    description: `Batch create, update, or delete calendar events. allDay events are auto-normalized to 00:00–23:59.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              description: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              allDay: z.boolean().optional(),
              startAt: z.string().describe('ISO 8601'),
              endAt: z.string().describe('ISO 8601'),
              color: z.string().nullable().optional(),
              priority: z.enum(['low', 'medium', 'high']).optional()
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              allDay: z.boolean().optional(),
              startAt: z.string().optional(),
              endAt: z.string().optional(),
              color: z.string().nullable().optional(),
              priority: z.enum(['low', 'medium', 'high']).optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of schedule actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/schedules/batch', args)
  }
  // ─── Reminders ────────────────────────────────────────────
]
