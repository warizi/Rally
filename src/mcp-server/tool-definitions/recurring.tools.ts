/**
 * MCP recurring tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_recurring_rules, manage_recurring_rules.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const recurringTools: ToolDefinition[] = [
  {
    name: 'list_recurring_rules',
    description: `List recurring rules in the active workspace.
- activeOnly=true filters to rules whose endDate is null or still in the future.
- forDate: pass a YYYY-MM-DD or ISO 8601 string to switch to the "today view" — returns only rules
  that fire on that date along with their completion status, plus the matching completions array.
  Response shape becomes { date, rules: [{ ...rule, completed }], completions: [...] }.
  When forDate is omitted, returns the plain { rules: [...] } list.`,
    schema: {
      activeOnly: z.boolean().optional(),
      forDate: z
        .string()
        .optional()
        .describe(
          'YYYY-MM-DD or ISO 8601 — when set, returns only rules that fire on that date with completion status'
        )
    },
    handler: ({ activeOnly, forDate }) => {
      if (typeof forDate === 'string' && forDate.trim()) {
        const params = new URLSearchParams()
        params.set('date', forDate)
        return callTool('GET', `/api/mcp/recurring/today?${params.toString()}`)
      }
      const params = new URLSearchParams()
      if (activeOnly) params.set('activeOnly', 'true')
      const qs = params.toString()
      return callTool('GET', `/api/mcp/recurring/rules${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_recurring_rules',
    description: `Batch create/update/delete recurring rules + complete/uncomplete daily occurrences.
recurrenceType:
- 'daily': fires every day
- 'weekday': Mon–Fri only
- 'weekend': Sat/Sun only
- 'custom': fires on the daysOfWeek array (0=Sun, 1=Mon, …, 6=Sat) — required with recurrenceType='custom'

startTime/endTime are 'HH:MM' strings or null. reminderOffsetMs is the lead time before startTime fires (or null to disable).

Completion actions:
- complete: { ruleId, date } — mark a rule completed for that day. Idempotent.
- uncomplete: { completionId } — undo a completion. completionId comes from list_recurring_rules with forDate set, or from a prior complete result.

All actions run in a single transaction. Result entries are { action, id, success: true } where id is the rule id (CRUD) or completion id (complete/uncomplete).`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              description: z.string().optional(),
              priority: z.enum(['high', 'medium', 'low']).optional(),
              recurrenceType: z.enum(['daily', 'weekday', 'weekend', 'custom']),
              daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
              startDate: z.string().describe('ISO 8601'),
              endDate: z.string().nullable().optional(),
              startTime: z.string().nullable().optional(),
              endTime: z.string().nullable().optional(),
              reminderOffsetMs: z.number().int().nullable().optional()
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
              priority: z.enum(['high', 'medium', 'low']).optional(),
              recurrenceType: z.enum(['daily', 'weekday', 'weekend', 'custom']).optional(),
              daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
              startDate: z.string().optional(),
              endDate: z.string().nullable().optional(),
              startTime: z.string().nullable().optional(),
              endTime: z.string().nullable().optional(),
              reminderOffsetMs: z.number().int().nullable().optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() }),
            z.object({
              action: z.literal('complete'),
              ruleId: z.string(),
              date: z
                .string()
                .describe('YYYY-MM-DD or ISO 8601 (the day this completion belongs to)')
            }),
            z.object({
              action: z.literal('uncomplete'),
              completionId: z.string().describe('Completion id from list_recurring_rules (forDate)')
            })
          ])
        )
        .describe('Array of recurring rule actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/recurring/rules/batch', args)
  }
  // ─── Templates ────────────────────────────────────────────
]
