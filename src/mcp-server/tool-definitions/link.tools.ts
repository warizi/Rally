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
  },
  {
    name: 'explore_graph',
    description: `Traverse the entity-link graph from a seed item up to N hops (BFS).
Use to discover related context around an item — e.g. notes/todos/canvases connected to a given note.
Returns { root, depth, nodes: [{type,id,title,depth}], edges: [{fromType,fromId,toType,toId}] }.
Pairs well with search: find a seed via search, then explore_graph to gather its neighborhood.`,
    schema: {
      type: z
        .enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule'])
        .describe('Seed entity type'),
      id: z.string().describe('Seed entity id'),
      depth: z.number().int().min(1).max(3).optional().describe('Traversal hops (default 1, max 3)')
    },
    handler: ({ type, id, depth }) => {
      const params = new URLSearchParams()
      params.set('type', type as string)
      params.set('id', id as string)
      if (typeof depth === 'number') params.set('depth', String(depth))
      return callTool('GET', `/api/mcp/explore-graph?${params.toString()}`)
    }
  }
]
