/**
 * MCP todo tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_todos, manage_todos.
 * MCP v2 — read_tasks 추가 (todo/schedule/recurring/reminder/history 통합).
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const todoTools: ToolDefinition[] = [
  {
    name: 'read_tasks',
    description: `Read tasks across the work cluster (todo + schedule + recurring + reminder + history) in one call.
Replaces v1 list_todos / list_schedules / list_reminders / list_recurring_rules / get_history.

types: subset of ['todo','schedule','recurring','reminder']; omit = all
mode: 'active' (default) / 'completed' / 'today'
- 'active': active todos + upcoming schedules + active recurring rules + pending reminders
- 'today': today's due todos + today's schedules + today firing recurring (with completed flag) + today reminders
- 'completed': day-grouped history (completed todos + recurring completions; schedule/reminder past not in scope)

Filters (apply where relevant):
- from / to: ISO 8601 range (schedules / today bounds)
- dueWithin: integer days from today (todo)
- priority[]: high|medium|low (todo)
- parentId: 'null' for top-level only, or a parent todo id
- linkedTo: { type, id } (todo)
- search: substring on title/description/location
- resolveLinks: include linkedItem previews
- pendingOnly: un-fired reminders
- activeOnly: recurring rules with endDate=null or future (default true)
- date / dateRange (completed mode): dayOffset, dayLimit, fromDate (YYYY-MM-DD), toDate, query

Response shape depends on mode:
- active: { todos?, schedules?, recurring?, reminders? }
- today: { date, todos?, schedules?, recurring?, recurringCompletions?, reminders? }
- completed: { days: [{date, todos, recurringCompletions}], hasMore, nextDayOffset, schedules?, reminders? }`,
    schema: {
      types: z
        .array(z.enum(['todo', 'schedule', 'recurring', 'reminder']))
        .optional()
        .describe('Task types to include (default: all)'),
      mode: z
        .enum(['active', 'completed', 'today'])
        .optional()
        .describe('View mode (default: active)'),
      from: z.string().optional().describe('ISO 8601 range start (schedule)'),
      to: z.string().optional().describe('ISO 8601 range end (schedule)'),
      dueWithin: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Todo due within N days from today'),
      priority: z
        .array(z.enum(['high', 'medium', 'low']))
        .optional()
        .describe('Todo priority filter'),
      parentId: z
        .string()
        .optional()
        .describe('Todo parentId — "null" for top-level only, or a parent todo id'),
      linkedTo: z
        .object({
          type: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
          id: z.string()
        })
        .optional()
        .describe('Todo filtered to those linked to this entity'),
      search: z.string().optional().describe('Substring on title/description/location'),
      resolveLinks: z
        .boolean()
        .optional()
        .describe('Include linkedItem previews (todo only, default: false)'),
      pendingOnly: z
        .boolean()
        .optional()
        .describe('Reminder: only un-fired (default: false)'),
      activeOnly: z
        .boolean()
        .optional()
        .describe('Recurring: only rules with endDate=null or future (default: true)'),
      date: z
        .string()
        .optional()
        .describe('today mode: anchor date (YYYY-MM-DD or ISO 8601; default today)'),
      dayOffset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('completed mode: pagination offset in active days'),
      dayLimit: z
        .number()
        .int()
        .min(1)
        .max(60)
        .optional()
        .describe('completed mode: days per page (default 10)'),
      fromDate: z
        .string()
        .optional()
        .describe('completed mode: YYYY-MM-DD inclusive lower bound'),
      toDate: z
        .string()
        .optional()
        .describe('completed mode: YYYY-MM-DD inclusive upper bound'),
      query: z
        .string()
        .optional()
        .describe('completed mode: substring on todo titles / linked file titles')
    },
    handler: (args) => {
      const params = new URLSearchParams()
      const a = args as Record<string, unknown>
      if (Array.isArray(a.types)) for (const t of a.types as string[]) params.append('types[]', t)
      if (typeof a.mode === 'string') params.set('mode', a.mode)
      if (typeof a.from === 'string') params.set('from', a.from)
      if (typeof a.to === 'string') params.set('to', a.to)
      if (typeof a.dueWithin === 'number') params.set('dueWithin', String(a.dueWithin))
      if (Array.isArray(a.priority))
        for (const p of a.priority as string[]) params.append('priority[]', p)
      if (typeof a.parentId === 'string') params.set('parentId', a.parentId)
      if (a.linkedTo && typeof a.linkedTo === 'object') {
        const lt = a.linkedTo as { type: string; id: string }
        params.set('linkedTo[type]', lt.type)
        params.set('linkedTo[id]', lt.id)
      }
      if (typeof a.search === 'string' && a.search.trim()) params.set('search', a.search)
      if (a.resolveLinks) params.set('resolveLinks', 'true')
      if (a.pendingOnly) params.set('pendingOnly', 'true')
      if (typeof a.activeOnly === 'boolean') params.set('activeOnly', a.activeOnly ? 'true' : 'false')
      if (typeof a.date === 'string') params.set('date', a.date)
      if (typeof a.dayOffset === 'number') params.set('dayOffset', String(a.dayOffset))
      if (typeof a.dayLimit === 'number') params.set('dayLimit', String(a.dayLimit))
      if (typeof a.fromDate === 'string') params.set('fromDate', a.fromDate)
      if (typeof a.toDate === 'string') params.set('toDate', a.toDate)
      if (typeof a.query === 'string' && (a.query as string).trim())
        params.set('query', a.query as string)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/tasks${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'list_todos',
    deprecated: {
      replacedBy: 'read_tasks',
      since: 'v2.0',
      reason: "read_tasks({ types: ['todo'] }) — also covers schedule/recurring/reminder"
    },
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
    deprecated: {
      replacedBy: 'manage_tasks',
      since: 'v2.0',
      reason: "manage_tasks with type: 'todo' covers all manage_todos actions in a unified API"
    },
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
