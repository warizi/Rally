/**
 * MCP canvas tools.
 * P3-7 — tool-definitions.ts 분할. 포함: read_canvas, create_canvas, edit_canvas.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import { type ToolDefinition, e } from './types'

export const canvasTools: ToolDefinition[] = [
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
  }
]
