/**
 * MCP tag tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_tags, list_tagged_items, manage_tags.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import { type ToolDefinition, e } from './types'

export const tagTools: ToolDefinition[] = [
  {
    name: 'list_tags',
    description: `List tags in the active workspace.
- search: substring match on name/description (workspace-wide listing)
- forItemType + forItemId: pass both to scope the response to tags attached to that specific item
  (overrides search). Item types: note, csv, canvas, todo, pdf, image, folder.`,
    schema: {
      search: z.string().optional(),
      forItemType: z
        .enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder'])
        .optional()
        .describe('Pair with forItemId to list tags attached to a specific item'),
      forItemId: z.string().optional().describe('Pair with forItemType')
    },
    handler: ({ search, forItemType, forItemId }) => {
      if (typeof forItemType === 'string' && typeof forItemId === 'string' && forItemId) {
        return callTool('GET', `/api/mcp/tagged/${e(forItemType)}/${e(forItemId)}`)
      }
      const params = new URLSearchParams()
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/tags${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'list_tagged_items',
    description: `List items that carry a given tag. Filter by itemTypes (default: all taggable types).
Orphan attachments (item deleted but tag link remains) are skipped from the response.`,
    schema: {
      tagId: z.string(),
      itemTypes: z
        .array(z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder']))
        .optional()
    },
    handler: ({ tagId, itemTypes }) => {
      const params = new URLSearchParams()
      if (Array.isArray(itemTypes) && itemTypes.length > 0) {
        for (const t of itemTypes as string[]) params.append('itemTypes[]', t)
      }
      const qs = params.toString()
      return callTool('GET', `/api/mcp/tags/${e(tagId as string)}/items${qs ? `?${qs}` : ''}`)
    }
  },
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
