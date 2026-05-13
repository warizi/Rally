/**
 * MCP trash tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_trash, manage_trash.
 * MCP v2 — read_trash 추가 (list_trash rename).
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import { type ToolDefinition, e } from './types'

const TRASH_TYPES = [
  'folder',
  'note',
  'csv',
  'pdf',
  'image',
  'canvas',
  'todo',
  'schedule',
  'recurring_rule',
  'template'
] as const

export const trashTools: ToolDefinition[] = [
  {
    name: 'read_trash',
    description: `List items in the workspace trash (deleted but recoverable). MCP v2 rename of list_trash.
Each batch represents one user/AI delete action — a folder + its contents share one batch, a sub-todo tree shares one batch.
Use manage_trash with action='restore' + batchId to recover.

Auto-emptied after the user-configured retention period (default 30 days).`,
    schema: {
      types: z.array(z.enum(TRASH_TYPES)).optional().describe('Filter by entity type'),
      search: z.string().optional().describe('Substring match on root title'),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(200).optional().describe('Default 50')
    },
    handler: ({ types, search, offset, limit }) => {
      const params = new URLSearchParams()
      if (Array.isArray(types) && types.length > 0) {
        for (const t of types as string[]) params.append('types[]', t)
      }
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      if (typeof offset === 'number') params.set('offset', String(offset))
      if (typeof limit === 'number') params.set('limit', String(limit))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/trash${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'list_trash',
    deprecated: {
      replacedBy: 'read_trash',
      since: 'v2.0',
      reason: 'read_trash — v2 read_* prefix alignment'
    },
    description: `List items in the workspace trash (deleted but recoverable).
Each batch represents one user/AI delete action — a folder + its contents share one batch, a sub-todo tree shares one batch.
Use restore_trash with batchId to recover, or empty_trash to permanently delete.

Auto-emptied after the user-configured retention period (default 30 days).`,
    schema: {
      types: z
        .array(
          z.enum([
            'folder',
            'note',
            'csv',
            'pdf',
            'image',
            'canvas',
            'todo',
            'schedule',
            'recurring_rule',
            'template'
          ])
        )
        .optional()
        .describe('Filter by entity type'),
      search: z.string().optional().describe('Substring match on root title'),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(200).optional().describe('Default 50')
    },
    handler: ({ types, search, offset, limit }) => {
      const params = new URLSearchParams()
      if (Array.isArray(types) && types.length > 0) {
        for (const t of types as string[]) params.append('types[]', t)
      }
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      if (typeof offset === 'number') params.set('offset', String(offset))
      if (typeof limit === 'number') params.set('limit', String(limit))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/trash${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_trash',
    description: `Restore trash batches (recover deleted items).
- action: 'restore' — recover the whole batch (root + cascade children). For folder/file domains: original location is reused if free, otherwise auto-renamed (e.g. "docs (1)"). entity-link snapshots are reattached when both endpoints are active.

MCP v2: 'purge' (permanent delete) removed — UI 전담 for safety. Users empty trash via the desktop UI.

Multiple actions execute sequentially. Each action is independent — failures don't roll back earlier successes.`,
    schema: {
      actions: z
        .array(
          z
            .object({
              action: z.literal('restore'),
              batchId: z.string().describe('Trash batch id from list_trash')
            })
            .describe('Restore a single trash batch')
        )
        .describe('Array of restore actions')
    },
    handler: async ({ actions }) => {
      const list = (actions as Array<Record<string, unknown>>) ?? []
      if (list.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ results: [] }, null, 2) }]
        }
      }
      if (list.length === 1) {
        const a = list[0]
        return callTool('POST', `/api/mcp/trash/${e(String(a.batchId))}/restore`)
      }
      // 다수 actions: 순차 실행, 결과 집계
      const results: Array<Record<string, unknown>> = []
      let workspace: unknown = null
      for (const a of list) {
        const res = await callTool('POST', `/api/mcp/trash/${e(String(a.batchId))}/restore`)
        const text = res.content?.[0]?.type === 'text' ? res.content[0].text : ''
        const parsed = text ? JSON.parse(text) : null
        if (workspace === null && parsed && typeof parsed === 'object' && '_workspace' in parsed) {
          workspace = (parsed as Record<string, unknown>)._workspace
        }
        const cleanResult =
          parsed && typeof parsed === 'object'
            ? Object.fromEntries(
                Object.entries(parsed as Record<string, unknown>).filter(
                  ([k]) => k !== '_workspace'
                )
              )
            : parsed
        results.push({
          action: a.action,
          batchId: a.batchId ?? null,
          isError: res.isError === true,
          result: cleanResult
        })
      }
      const payload = workspace !== null ? { _workspace: workspace, results } : { results }
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }]
      }
    }
  }
]
