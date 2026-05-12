/**
 * MCP template tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_templates, manage_templates.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import { type ToolDefinition, e } from './types'

export const templateTools: ToolDefinition[] = [
  {
    name: 'list_templates',
    description: `List note/csv templates in the active workspace.
- Without id: returns metadata list (jsonData omitted to save tokens).
- With id: returns the single template with full jsonData (the serialized payload — JSON string for note templates consumable by write_content's content field, CSV body for csv templates). When id is set, type filter is ignored.`,
    schema: {
      type: z
        .enum(['note', 'csv'])
        .optional()
        .describe('Filter by template type (ignored when id is set)'),
      id: z
        .string()
        .optional()
        .describe('When set, returns full content of that template instead of a list')
    },
    handler: ({ type, id }) => {
      if (typeof id === 'string' && id) {
        return callTool('GET', `/api/mcp/templates/${e(id)}`)
      }
      const params = new URLSearchParams()
      if (type) params.set('type', type as string)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/templates${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_templates',
    description: `Batch create or delete templates. Templates do not support update — delete + recreate to change content.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              type: z.enum(['note', 'csv']),
              jsonData: z.string().describe('Serialized template payload (markdown JSON or CSV)')
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of template actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/templates/batch', args)
  }
  // ─── Tags ─────────────────────────────────────────────────
]
