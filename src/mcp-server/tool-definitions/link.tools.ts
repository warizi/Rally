/**
 * MCP link tools.
 * P3-7 — tool-definitions.ts 분할. 포함: manage_links.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const linkTools: ToolDefinition[] = [
  {
    name: 'manage_links',
    description: `Batch link/unlink between any items (note, csv, canvas, todo, pdf, image, schedule).
Links are bidirectional — order of source/target does not matter.

MCP v2: 'list' action removed. To query links for an entity, use:
- browse({ linkedTo: { type, id } }) — items linked to that entity
- read_tasks({ linkedTo: { type, id } }) — tasks linked to that entity`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('link'),
              sourceType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
              sourceId: z.string(),
              targetType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
              targetId: z.string()
            }),
            z.object({
              action: z.literal('unlink'),
              sourceType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
              sourceId: z.string(),
              targetType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
              targetId: z.string()
            })
          ])
        )
        .describe('Array of link/unlink actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/links/batch', args)
  }
  // ─── Schedules (calendar events) ──────────────────────────
]
