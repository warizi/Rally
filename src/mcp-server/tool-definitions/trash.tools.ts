/**
 * MCP trash tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_trash, manage_trash.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import { type ToolDefinition, e } from './types'

export const trashTools: ToolDefinition[] = [
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
    description: `Restore or permanently delete trash batches.
- action: 'restore' — recover the whole batch (root + cascade children). For folder/file domains: original location is reused if free, otherwise auto-renamed (e.g. "docs (1)"). entity-link snapshots are reattached when both endpoints are active.
- action: 'purge' — permanently delete. Pass batchId for a single batch, or omit batchId with confirm=true to purge ALL workspace trash. Returns purgedBatchIds; if hasMore=true call again to keep purging.

Multiple actions execute sequentially. Each action is independent — failures don't roll back earlier successes.`,
    schema: {
      actions: z
        .array(
          z.union([
            z
              .object({
                action: z.literal('restore'),
                batchId: z.string().describe('Trash batch id from list_trash')
              })
              .describe('Restore a single trash batch'),
            z
              .object({
                action: z.literal('purge'),
                batchId: z.string().optional().describe('Single batch to purge'),
                confirm: z
                  .boolean()
                  .optional()
                  .describe('Required (true) when batchId is omitted to purge all trash')
              })
              .describe('Permanently delete a batch (or all trash with confirm=true)')
          ])
        )
        .describe('Array of trash actions')
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
        if (a.action === 'restore') {
          return callTool('POST', `/api/mcp/trash/${e(String(a.batchId))}/restore`)
        }
        return callTool('POST', '/api/mcp/trash/empty', {
          ...(a.batchId ? { batchId: a.batchId } : {}),
          ...(a.confirm ? { confirm: a.confirm } : {})
        })
      }
      // 다수 actions: 순차 실행, 결과 집계
      const results: Array<Record<string, unknown>> = []
      let workspace: unknown = null
      for (const a of list) {
        const res =
          a.action === 'restore'
            ? await callTool('POST', `/api/mcp/trash/${e(String(a.batchId))}/restore`)
            : await callTool('POST', '/api/mcp/trash/empty', {
                ...(a.batchId ? { batchId: a.batchId } : {}),
                ...(a.confirm ? { confirm: a.confirm } : {})
              })
        const text = res.content?.[0]?.type === 'text' ? res.content[0].text : ''
        const parsed = text ? JSON.parse(text) : null
        // _workspace는 router에서 모든 응답에 주입되는 메타 — 단일 액션 path와 shape 일관성 위해 끌어올림
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
