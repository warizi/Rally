/**
 * MCP todo tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_todos, manage_todos.
 * MCP v2 — read_tasks (work 통합 read) + manage_tasks (work 통합 manage) 추가.
 */
import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

const LINK_TYPE = z.enum(['note', 'csv', 'canvas', 'pdf', 'image', 'schedule', 'todo'])
const PRIORITY = z.enum(['high', 'medium', 'low'])
const TODO_STATUS = z.enum(['할일', '진행중', '완료', '보류'])
const RECURRENCE = z.enum(['daily', 'weekday', 'weekend', 'custom'])

function typeEndpoint(t: string): string | null {
  switch (t) {
    case 'todo':
      return '/api/mcp/todos/batch'
    case 'schedule':
      return '/api/mcp/schedules/batch'
    case 'recurring':
      return '/api/mcp/recurring/rules/batch'
    case 'reminder':
      return '/api/mcp/reminders/batch'
    default:
      return null
  }
}

export const todoTools: ToolDefinition[] = [
  {
    name: 'manage_tasks',
    description: `Batch CRUD across the work cluster (todo + schedule + recurring + reminder).
Replaces v1 manage_todos + manage_schedules + manage_recurring_rules + manage_reminders.

Each action carries a 'type' discriminator. Order is preserved across mixed types — consecutive same-type actions
are dispatched as a single sub-batch to the v1 endpoint (atomicity per sub-batch).

Action shapes by type:

- todo:
  - { type:'todo', action:'create', title, description?, status?, priority?, dueDate?, startDate?, parentId?, subtodos?, linkItems? }
  - { type:'todo', action:'update', id, title?, description?, status?, priority?, isDone?, parentId?, dueDate?, startDate?, linkItems?, unlinkItems? }
  - { type:'todo', action:'delete', id }

Create a subtodo directly via create.parentId — supports full fields (description / priority / dates / linkItems).
Move a todo across the tree via update.parentId: null = promote to root, string = move under that parent.
Only 2-depth hierarchy is allowed — a todo that already has subtodos cannot itself become a subtodo,
and a subtodo cannot have children (combining create.parentId with create.subtodos is rejected).
Cross-workspace parents are rejected.

- schedule:
  - { type:'schedule', action:'create', title, description?, location?, allDay?, startAt, endAt, color?, priority? }
  - { type:'schedule', action:'update', id, ...fields }
  - { type:'schedule', action:'delete', id }

- recurring (recurring-rule + completion toggle):
  - { type:'recurring', action:'create', title, description?, priority?, recurrenceType, daysOfWeek?, startDate, endDate?, startTime?, endTime?, reminderOffsetMs? }
  - { type:'recurring', action:'update', id, ...fields }
  - { type:'recurring', action:'delete', id }
  - { type:'recurring', action:'complete', ruleId, date }       — mark a rule completed for that day
  - { type:'recurring', action:'uncomplete', completionId }     — undo a completion

- reminder (update unsupported — delete + create instead):
  - { type:'reminder', action:'create', entityType:'todo'|'schedule', entityId, offsetMs }   — offsetMs ∈ {600000, 1800000, 3600000, 86400000, 172800000}
  - { type:'reminder', action:'delete', id }

Subtodos (in todo create.subtodos) only accept title; other fields require separate update.
Subtodos support links (linkItems/unlinkItems) since MCP v2.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              type: z.literal('todo'),
              action: z.literal('create'),
              title: z.string(),
              description: z.string().optional(),
              status: TODO_STATUS.optional(),
              priority: PRIORITY.optional(),
              dueDate: z.string().optional(),
              startDate: z.string().optional(),
              parentId: z.string().optional(),
              subtodos: z.array(z.object({ title: z.string() })).optional(),
              linkItems: z.array(z.object({ type: LINK_TYPE, id: z.string() })).optional()
            }),
            z.object({
              type: z.literal('todo'),
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
              status: TODO_STATUS.optional(),
              priority: PRIORITY.optional(),
              isDone: z.boolean().optional(),
              parentId: z.string().nullable().optional(),
              dueDate: z.string().nullable().optional(),
              startDate: z.string().nullable().optional(),
              linkItems: z.array(z.object({ type: LINK_TYPE, id: z.string() })).optional(),
              unlinkItems: z.array(z.object({ type: LINK_TYPE, id: z.string() })).optional()
            }),
            z.object({ type: z.literal('todo'), action: z.literal('delete'), id: z.string() }),

            z.object({
              type: z.literal('schedule'),
              action: z.literal('create'),
              title: z.string(),
              description: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              allDay: z.boolean().optional(),
              startAt: z.string(),
              endAt: z.string(),
              color: z.string().nullable().optional(),
              priority: PRIORITY.optional()
            }),
            z.object({
              type: z.literal('schedule'),
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              allDay: z.boolean().optional(),
              startAt: z.string().optional(),
              endAt: z.string().optional(),
              color: z.string().nullable().optional(),
              priority: PRIORITY.optional()
            }),
            z.object({
              type: z.literal('schedule'),
              action: z.literal('delete'),
              id: z.string()
            }),

            z.object({
              type: z.literal('recurring'),
              action: z.literal('create'),
              title: z.string(),
              description: z.string().optional(),
              priority: PRIORITY.optional(),
              recurrenceType: RECURRENCE,
              daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
              startDate: z.string(),
              endDate: z.string().nullable().optional(),
              startTime: z.string().nullable().optional(),
              endTime: z.string().nullable().optional(),
              reminderOffsetMs: z.number().int().nullable().optional()
            }),
            z.object({
              type: z.literal('recurring'),
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
              priority: PRIORITY.optional(),
              recurrenceType: RECURRENCE.optional(),
              daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
              startDate: z.string().optional(),
              endDate: z.string().nullable().optional(),
              startTime: z.string().nullable().optional(),
              endTime: z.string().nullable().optional(),
              reminderOffsetMs: z.number().int().nullable().optional()
            }),
            z.object({
              type: z.literal('recurring'),
              action: z.literal('delete'),
              id: z.string()
            }),
            z.object({
              type: z.literal('recurring'),
              action: z.literal('complete'),
              ruleId: z.string(),
              date: z.string()
            }),
            z.object({
              type: z.literal('recurring'),
              action: z.literal('uncomplete'),
              completionId: z.string()
            }),

            z.object({
              type: z.literal('reminder'),
              action: z.literal('create'),
              entityType: z.enum(['todo', 'schedule']),
              entityId: z.string(),
              offsetMs: z.number().int().positive()
            }),
            z.object({
              type: z.literal('reminder'),
              action: z.literal('delete'),
              id: z.string()
            })
          ])
        )
        .describe('Mixed type+action batch')
    },
    handler: async (args) => {
      const actions = (args as { actions: Array<{ type: string; [k: string]: unknown }> }).actions
      // 같은 type 의 연속 action 을 한 sub-batch 로 묶어 v1 endpoint 로 분배.
      const groups: Array<{ type: string; actions: Array<Record<string, unknown>> }> = []
      for (const a of actions) {
        const last = groups[groups.length - 1]
        if (last && last.type === a.type) {
          last.actions.push(a)
        } else {
          groups.push({ type: a.type, actions: [a] })
        }
      }
      const aggregated: Array<Record<string, unknown>> = []
      let workspace: unknown = null
      let hadError = false
      for (const g of groups) {
        const ep = typeEndpoint(g.type)
        if (!ep) {
          aggregated.push({
            type: g.type,
            success: false,
            error: { code: 'ValidationError', message: `Unknown type: ${g.type}` }
          })
          hadError = true
          continue
        }
        const stripped = g.actions.map(({ type: _t, ...rest }) => rest)
        const result: CallToolResult = await callTool('POST', ep, { actions: stripped })
        const first = result.content?.[0]
        if (!first || first.type !== 'text' || typeof first.text !== 'string') {
          hadError = true
          aggregated.push({
            type: g.type,
            success: false,
            error: { code: 'UnexpectedResult', message: 'no text content' }
          })
          continue
        }
        try {
          const parsed = JSON.parse(first.text) as Record<string, unknown>
          if (workspace === null && '_workspace' in parsed) workspace = parsed._workspace
          if (result.isError) {
            hadError = true
            aggregated.push({ type: g.type, success: false, error: parsed })
            continue
          }
          const subResults = (parsed.results as Array<Record<string, unknown>> | undefined) ?? []
          for (const r of subResults) aggregated.push({ type: g.type, ...r })
        } catch {
          hadError = true
          aggregated.push({
            type: g.type,
            success: false,
            error: { code: 'ParseError', message: first.text.slice(0, 200) }
          })
        }
      }
      const payload: Record<string, unknown> =
        workspace !== null
          ? { _workspace: workspace, results: aggregated }
          : { results: aggregated }
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        ...(hadError ? { isError: true } : {})
      }
    }
  },
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
- search: substring filter applied to ALL returned types — todo & schedule (title/description/
  location), recurring (title/description), and reminders (matched via their parent todo/schedule).
  In 'active' mode (and only when no
  parentId/priority/linkedTo/dueWithin filter is set), response also adds 'similar': up to 3
  semantically-related todos (vector search) not already in results — surfaces meaning-matched
  todos even when the word isn't in the title.
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
      dueWithin: z.number().int().min(0).optional().describe('Todo due within N days from today'),
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
      pendingOnly: z.boolean().optional().describe('Reminder: only un-fired (default: false)'),
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
      fromDate: z.string().optional().describe('completed mode: YYYY-MM-DD inclusive lower bound'),
      toDate: z.string().optional().describe('completed mode: YYYY-MM-DD inclusive upper bound'),
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
      if (typeof a.activeOnly === 'boolean')
        params.set('activeOnly', a.activeOnly ? 'true' : 'false')
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
  }
]
