/**
 * MCP tag tools.
 * MCP v2 — list_tags / list_tagged_items 제거 (browse 로 흡수). manage_tags 만 잔존.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const tagTools: ToolDefinition[] = [
  {
    name: 'manage_tags',
    description: `Batch tag operations:
- create / update / delete: tag CRUD
- attach / detach: link a tag to a taggable item (note/csv/canvas/todo/pdf/image/folder)
delete also detaches from all items.

MCP v2: action naming unified (was create_tag/update_tag/delete_tag in v1). Tool handler maps to backend names transparently.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              name: z.string(),
              color: z.string().optional(),
              description: z.string().optional()
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              name: z.string().optional(),
              color: z.string().optional(),
              description: z.string().nullable().optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() }),
            z.object({
              action: z.literal('attach'),
              tagId: z.string(),
              itemType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder']),
              itemId: z.string()
            }),
            z.object({
              action: z.literal('detach'),
              tagId: z.string(),
              itemType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder']),
              itemId: z.string()
            })
          ])
        )
        .describe('Array of tag actions')
    },
    handler: (args) => {
      // v2 action names → v1 backend action names mapping
      const a = args as { actions: Array<{ action: string; [k: string]: unknown }> }
      const mapped = a.actions.map((act) => {
        if (act.action === 'create') return { ...act, action: 'create_tag' }
        if (act.action === 'update') return { ...act, action: 'update_tag' }
        if (act.action === 'delete') return { ...act, action: 'delete_tag' }
        return act
      })
      return callTool('POST', '/api/mcp/tags/batch', { actions: mapped })
    }
  }
  // ─── History ──────────────────────────────────────────────
]
