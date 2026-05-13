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
  }
]
