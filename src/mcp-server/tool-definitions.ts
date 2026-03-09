import { z } from 'zod'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { callTool } from './lib/call-tool'

type ToolSchema = Record<string, z.ZodType>

interface ToolDefinition {
  name: string
  description: string
  schema: ToolSchema
  handler: ToolCallback<ToolSchema>
}

const e = encodeURIComponent

const tools: ToolDefinition[] = [
  {
    name: 'list_items',
    description:
      'List all items (folders, notes, tables, canvases, todo summary) in the active workspace',
    schema: {},
    handler: () => callTool('GET', '/api/mcp/items')
  },
  {
    name: 'search_notes',
    description: 'Search notes by title or content. Returns up to 50 results.',
    schema: {
      query: z.string().describe('Search query (case-insensitive)')
    },
    handler: ({ query }) => callTool('GET', `/api/mcp/notes/search?q=${e(query as string)}`)
  },
  {
    name: 'read_content',
    description:
      'Read the full content of a note (markdown) or table (CSV). Auto-detects type by ID.',
    schema: {
      id: z.string().describe('Note or table ID (from list_items)')
    },
    handler: ({ id }) => callTool('GET', `/api/mcp/content/${e(id as string)}`)
  },
  {
    name: 'write_content',
    description: `Create or update a note/table. If id is provided, updates existing content. If not, creates new.
WARNING: When updating a note, image references (![](/.images/xxx.png)) removed from new content will be permanently deleted from disk. Always preserve existing image references.`,
    schema: {
      type: z
        .enum(['note', 'table'])
        .optional()
        .describe('Required for create, auto-detected for update'),
      id: z.string().optional().describe('Item ID — provide to update, omit to create'),
      title: z.string().optional().describe('Title — required for create'),
      folderId: z.string().optional().describe('Folder ID for create (omit for root)'),
      content: z.string().describe('Full content (markdown for note, CSV for table)')
    },
    handler: (args) => callTool('POST', '/api/mcp/content', args)
  },
  {
    name: 'manage_items',
    description: 'Batch rename, move, or delete notes and tables. Type is auto-detected by ID.',
    schema: {
      actions: z
        .array(
          z.union([
            z.object({ action: z.literal('rename'), id: z.string(), newName: z.string() }),
            z.object({
              action: z.literal('move'),
              id: z.string(),
              targetFolderId: z.string().optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of actions to execute')
    },
    handler: (args) => callTool('POST', '/api/mcp/items/batch', args)
  },
  {
    name: 'manage_folders',
    description: 'Batch create, rename, move, or delete folders. Actions execute sequentially.',
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              name: z.string(),
              parentFolderId: z.string().optional()
            }),
            z.object({ action: z.literal('rename'), folderId: z.string(), newName: z.string() }),
            z.object({
              action: z.literal('move'),
              folderId: z.string(),
              parentFolderId: z.string().optional()
            }),
            z.object({ action: z.literal('delete'), folderId: z.string() })
          ])
        )
        .describe('Array of folder actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/folders/batch', args)
  },
  {
    name: 'read_canvas',
    description:
      'Read a canvas with all nodes and edges. Nodes include reference data for linked items.',
    schema: {
      canvasId: z.string().describe('Canvas ID')
    },
    handler: ({ canvasId }) => callTool('GET', `/api/mcp/canvases/${e(canvasId as string)}`)
  },
  {
    name: 'create_canvas',
    description:
      'Create a canvas with optional nodes and edges in one call. Edges reference nodes by array index.',
    schema: {
      title: z.string().describe('Canvas title'),
      description: z.string().optional().describe('Canvas description'),
      nodes: z
        .array(
          z.object({
            type: z.enum(['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']),
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            content: z.string().optional(),
            refId: z.string().optional(),
            color: z.string().optional()
          })
        )
        .optional()
        .describe('Nodes to create'),
      edges: z
        .array(
          z.object({
            fromNodeIndex: z.number().describe('Source node index in nodes array'),
            toNodeIndex: z.number().describe('Target node index in nodes array'),
            fromSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
            toSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
            label: z.string().optional(),
            color: z.string().optional(),
            style: z.enum(['solid', 'dashed', 'dotted']).optional(),
            arrow: z.enum(['none', 'end', 'both']).optional()
          })
        )
        .optional()
        .describe('Edges connecting nodes by index')
    },
    handler: (args) => callTool('POST', '/api/mcp/canvases', args)
  },
  {
    name: 'edit_canvas',
    description: `Edit a canvas: update metadata, delete canvas, add/remove nodes and edges in one batch.
Delete must be the only action. Use tempId on add_node to reference new nodes in add_edge.`,
    schema: {
      canvasId: z.string().describe('Canvas ID'),
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('update'),
              title: z.string().optional(),
              description: z.string().optional()
            }),
            z.object({ action: z.literal('delete') }),
            z.object({
              action: z.literal('add_node'),
              tempId: z.string().optional(),
              type: z.enum(['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']),
              x: z.number(),
              y: z.number(),
              width: z.number().optional(),
              height: z.number().optional(),
              content: z.string().optional(),
              refId: z.string().optional(),
              color: z.string().optional()
            }),
            z.object({ action: z.literal('remove_node'), nodeId: z.string() }),
            z.object({
              action: z.literal('add_edge'),
              fromNode: z.string(),
              toNode: z.string(),
              fromSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
              toSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
              label: z.string().optional(),
              color: z.string().optional(),
              style: z.enum(['solid', 'dashed', 'dotted']).optional(),
              arrow: z.enum(['none', 'end', 'both']).optional()
            }),
            z.object({ action: z.literal('remove_edge'), edgeId: z.string() })
          ])
        )
        .describe('Actions to perform on the canvas')
    },
    handler: ({ canvasId, ...rest }) =>
      callTool('POST', `/api/mcp/canvases/${e(canvasId as string)}/edit`, rest)
  },
  {
    name: 'list_todos',
    description: `List all todos in the active workspace. Supports filter: all, active, completed.
Each todo includes linkedItems array with related items. To inspect a linked item:
- type "note" or "csv" → use read_content with the id
- type "canvas" → use read_canvas with the id as canvasId
- type "schedule", "pdf", "image" → metadata only (no detail tool available)`,
    schema: {
      filter: z.enum(['active', 'completed']).optional().describe('Filter (default: active)')
    },
    handler: ({ filter }) => callTool('GET', `/api/mcp/todos${filter ? `?filter=${filter}` : ''}`)
  },
  {
    name: 'manage_todos',
    description: `Batch create, update, or delete todos. Status/isDone auto-sync.
Subtodos are created inline via the subtodos array (title only). linkItems supported on top-level todos only.`,
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
  },
  {
    name: 'manage_links',
    description: `Batch link, unlink, or list links between any items (note, csv, canvas, todo, pdf, image, schedule).
Links are bidirectional — order of source/target does not matter.`,
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
            }),
            z.object({
              action: z.literal('list'),
              entityType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
              entityId: z.string()
            })
          ])
        )
        .describe('Array of link actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/links/batch', args)
  }
]

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema
      },
      tool.handler
    )
  }
}
