/**
 * MCP canvas tools.
 * P3-7 — tool-definitions.ts 분할. 포함: read_canvas, create_canvas, edit_canvas.
 * MCP v2 — manage_canvas 추가 (create_canvas + edit_canvas 통합).
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import { type ToolDefinition, e } from './types'

const NODE_TYPE = z.enum(['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image'])
const EDGE_SIDE = z.enum(['top', 'right', 'bottom', 'left'])
const EDGE_STYLE = z.enum(['solid', 'dashed', 'dotted'])
const EDGE_ARROW = z.enum(['none', 'end', 'both'])

export const canvasTools: ToolDefinition[] = [
  {
    name: 'manage_canvas',
    description: `Canvas batch CRUD + node/edge ops. Replaces v1 create_canvas + edit_canvas (single tool with action discriminator).

Actions (mutually exclusive groups):
- create: { action:'create', title, description?, nodes?[], edges?[] }  — single action; canvasId is omitted; response includes new canvasId
- delete: { action:'delete' }                                            — single action with canvasId
- update: { action:'update', title?, description? }                      — meta update; needs canvasId
- add_node: { action:'add_node', tempId?, type, x, y, width?, height?, content?, refId?, color? }
- remove_node: { action:'remove_node', nodeId }
- add_edge: { action:'add_edge', fromNode, toNode, fromSide?, toSide?, label?, color?, style?, arrow? }
- remove_edge: { action:'remove_edge', edgeId }

For non-create / non-delete actions: provide canvasId. add_node / remove_node / add_edge / remove_edge can be mixed in one call. add_edge can reference add_node's tempId.`,
    schema: {
      canvasId: z
        .string()
        .optional()
        .describe('Canvas id — required for all actions except a single create.'),
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              description: z.string().optional(),
              nodes: z
                .array(
                  z.object({
                    type: NODE_TYPE,
                    x: z.number(),
                    y: z.number(),
                    width: z.number().optional(),
                    height: z.number().optional(),
                    content: z.string().optional(),
                    refId: z.string().optional(),
                    color: z.string().optional()
                  })
                )
                .optional(),
              edges: z
                .array(
                  z.object({
                    fromNodeIndex: z.number(),
                    toNodeIndex: z.number(),
                    fromSide: EDGE_SIDE.optional(),
                    toSide: EDGE_SIDE.optional(),
                    label: z.string().optional(),
                    color: z.string().optional(),
                    style: EDGE_STYLE.optional(),
                    arrow: EDGE_ARROW.optional()
                  })
                )
                .optional()
            }),
            z.object({
              action: z.literal('update'),
              title: z.string().optional(),
              description: z.string().optional()
            }),
            z.object({ action: z.literal('delete') }),
            z.object({
              action: z.literal('add_node'),
              tempId: z.string().optional(),
              type: NODE_TYPE,
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
              fromSide: EDGE_SIDE.optional(),
              toSide: EDGE_SIDE.optional(),
              label: z.string().optional(),
              color: z.string().optional(),
              style: EDGE_STYLE.optional(),
              arrow: EDGE_ARROW.optional()
            }),
            z.object({ action: z.literal('remove_edge'), edgeId: z.string() })
          ])
        )
        .min(1)
        .describe('Array of canvas actions')
    },
    handler: (args) => {
      const a = args as { canvasId?: string; actions: Array<{ action: string; [k: string]: unknown }> }
      const isCreate = a.actions.some((act) => act.action === 'create')
      if (isCreate) {
        // create must be the only action
        if (a.actions.length !== 1) {
          return Promise.resolve({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: "'create' action must be used alone (single action in array)"
                })
              }
            ],
            isError: true
          })
        }
        const c = a.actions[0]
        return callTool('POST', '/api/mcp/canvases', {
          title: c.title,
          description: c.description,
          nodes: c.nodes,
          edges: c.edges
        })
      }
      // edit-style actions — canvasId required
      if (!a.canvasId) {
        return Promise.resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'canvasId is required for non-create actions' })
            }
          ],
          isError: true
        })
      }
      return callTool('POST', `/api/mcp/canvases/${e(a.canvasId)}/edit`, { actions: a.actions })
    }
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
  }
]
