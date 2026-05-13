/**
 * MCP todo tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_todos, manage_todos.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const todoTools: ToolDefinition[] = [
  {
    name: 'list_todos',
    description: `List todos in the active workspace.
Filter options (all optional, AND-combined):
- filter: 'active' (top-level not done + all subtodos) or 'completed' (top-level done)
- parentId: 'null' for top-level only, or a todo id to fetch its direct children
- linkedTo: { type, id } — only todos linked to that entity
- dueWithin: number of days from today (e.g. 7 = this week's deadlines)
- priority: subset of ['high','medium','low']
- search: substring match on title (case-insensitive)
- resolveLinks: when true, linkedItems[].preview is filled (note/csv/pdf/image preview, canvas/todo/schedule description)

Each todo includes linkedItems[]. To inspect a linked item:
- type "note" or "csv" → read_content
- type "canvas" → read_canvas
- type "schedule"/"pdf"/"image" → metadata only

Subtodos support links — link/unlink operations work on any todo regardless of parentId.`,
    schema: {
      filter: z.enum(['active', 'completed']).optional().describe('Filter (default: active)'),
      parentId: z
        .string()
        .optional()
        .describe('Pass "null" for top-level only, or a parent todo id for its children'),
      linkedTo: z
        .object({
          type: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
          id: z.string()
        })
        .optional()
        .describe('Only return todos linked to this entity'),
      dueWithin: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Only todos with dueDate within N days from today'),
      priority: z
        .array(z.enum(['high', 'medium', 'low']))
        .optional()
        .describe('Filter by priority (any of)'),
      search: z.string().optional().describe('Substring match on title'),
      resolveLinks: z
        .boolean()
        .optional()
        .describe('Include preview/description for each linkedItem (default: false)')
    },
    handler: ({ filter, parentId, linkedTo, dueWithin, priority, search, resolveLinks }) => {
      const params = new URLSearchParams()
      if (filter) params.set('filter', filter as string)
      if (typeof parentId === 'string') params.set('parentId', parentId)
      if (linkedTo && typeof linkedTo === 'object') {
        const lt = linkedTo as { type: string; id: string }
        params.set('linkedTo[type]', lt.type)
        params.set('linkedTo[id]', lt.id)
      }
      if (typeof dueWithin === 'number') params.set('dueWithin', String(dueWithin))
      if (Array.isArray(priority) && priority.length > 0) {
        for (const p of priority as string[]) params.append('priority[]', p)
      }
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      if (resolveLinks) params.set('resolveLinks', 'true')
      const qs = params.toString()
      return callTool('GET', `/api/mcp/todos${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_todos',
    description: `Batch create, update, or delete todos. Status/isDone auto-sync.
Subtodos: created inline via the subtodos array. Title only — matches the UI which only allows entering a title.
Other fields (priority/dueDate/etc.) on a subtodo can be set later via a separate update action targeting the subtodo's id.
Links: linkItems / unlinkItems work on any todo, including subtodos.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              description: z.string().optional(),
              status: z.enum(['할일', '진행중', '완료', '보류']).optional(),
              priority: z.enum(['high', 'medium', 'low']).optional(),
              dueDate: z.string().optional().describe('ISO 8601 date'),
              startDate: z.string().optional().describe('ISO 8601 date'),
              subtodos: z
                .array(z.object({ title: z.string() }))
                .optional()
                .describe('Subtodos to create under this todo (title only)'),
              linkItems: z
                .array(
                  z.object({
                    type: z.enum(['note', 'csv', 'canvas', 'pdf', 'image', 'schedule', 'todo']),
                    id: z.string()
                  })
                )
                .optional()
                .describe('Items to link to this todo after creation')
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
              status: z.enum(['할일', '진행중', '완료', '보류']).optional(),
              priority: z.enum(['high', 'medium', 'low']).optional(),
              isDone: z.boolean().optional(),
              dueDate: z.string().nullable().optional(),
              startDate: z.string().nullable().optional(),
              linkItems: z
                .array(
                  z.object({
                    type: z.enum(['note', 'csv', 'canvas', 'pdf', 'image', 'schedule', 'todo']),
                    id: z.string()
                  })
                )
                .optional()
                .describe('Items to link to this todo'),
              unlinkItems: z
                .array(
                  z.object({
                    type: z.enum(['note', 'csv', 'canvas', 'pdf', 'image', 'schedule', 'todo']),
                    id: z.string()
                  })
                )
                .optional()
                .describe('Items to unlink from this todo')
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of todo actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/todos/batch', args)
  }
]
