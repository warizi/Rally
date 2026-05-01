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
    description: `List items (folders, notes, tables, canvases, todo summary) in the active workspace.
All options are optional and default to a full listing for backward compatibility, but for token efficiency
you should narrow the response when possible:
- folderId + recursive=false: list only direct children of a specific folder
- types: ["folder"] (or any subset) to fetch only what you need
- summary=true: omit preview / relativePath / folderPath / description (id+title+folderId+updatedAt only)
- updatedAfter: only items modified after the given ISO timestamp
- limit/offset: paginate per kind (default limit 500, max 1000); response.meta.hasMore tells you when to page
Response includes a meta block with totals, hasMore flags, and the resolved options.`,
    schema: {
      folderId: z.string().optional().describe('Restrict to items inside this folder'),
      recursive: z
        .boolean()
        .optional()
        .describe('When folderId is set, include all descendants (default: direct children only)'),
      types: z
        .array(z.enum(['folder', 'note', 'table', 'canvas']))
        .optional()
        .describe('Limit response to specific kinds. Omit to include all.'),
      summary: z
        .boolean()
        .optional()
        .describe(
          'Strip heavy fields (preview, relativePath, folderPath, description) to reduce token usage'
        ),
      updatedAfter: z
        .string()
        .optional()
        .describe('ISO 8601 timestamp — only items updated after this moment'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe('Per-kind row cap (default 500, max 1000)'),
      offset: z.number().int().min(0).optional().describe('Per-kind offset for pagination')
    },
    handler: ({ folderId, recursive, types, summary, updatedAfter, limit, offset }) => {
      const params = new URLSearchParams()
      if (folderId) params.set('folderId', folderId as string)
      if (recursive) params.set('recursive', 'true')
      if (summary) params.set('summary', 'true')
      if (Array.isArray(types) && types.length > 0) {
        for (const t of types as string[]) params.append('types[]', t)
      }
      if (updatedAfter) params.set('updatedAfter', updatedAfter as string)
      if (typeof limit === 'number') params.set('limit', String(limit))
      if (typeof offset === 'number') params.set('offset', String(offset))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/items${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'search',
    description: `Unified search across notes, tables, canvases, and todos.
- types: subset of ["note", "table", "canvas", "todo"]; defaults to ["note"] (search_notes-compatible)
- offset/limit: paginate (default limit 50, max 100). Response includes total/hasMore/nextOffset
- highlight: when true, each hit includes an excerpt (~50 chars padding around the match)
Title matches rank above content/description matches; ties break by updatedAt desc.`,
    schema: {
      query: z.string().describe('Search query (case-insensitive substring)'),
      types: z
        .array(z.enum(['note', 'table', 'canvas', 'todo']))
        .optional()
        .describe('Domains to search (default: ["note"])'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default: 0)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Page size (default: 50, max: 100)'),
      highlight: z
        .boolean()
        .optional()
        .describe('Include excerpt around the match (default: false)')
    },
    handler: ({ query, types, offset, limit, highlight }) => {
      const params = new URLSearchParams()
      params.set('q', query as string)
      if (Array.isArray(types) && types.length > 0) {
        for (const t of types as string[]) params.append('types[]', t)
      }
      if (typeof offset === 'number') params.set('offset', String(offset))
      if (typeof limit === 'number') params.set('limit', String(limit))
      if (highlight) params.set('highlight', 'true')
      return callTool('GET', `/api/mcp/search?${params.toString()}`)
    }
  },
  {
    name: 'read_contents',
    description: `Batch read the contents of multiple notes/tables in one round-trip. Up to 50 IDs.
Pass a single id in the array for one-shot reads. Each result is independent: if one ID fails
(not found, fs error, etc.) the others still succeed.
Result entries:
- success=true: { id, type: 'note'|'table', title, relativePath, content [, encoding, columnWidths] }
- success=false: { id, error: { code, message } }`,
    schema: {
      ids: z.array(z.string()).min(1).max(50).describe('Note or table IDs (1–50)')
    },
    handler: (args) => callTool('POST', '/api/mcp/contents/batch', args)
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

Subtodos do NOT support links — those operations must target the top-level parent.`,
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
    description: `Batch create, update, or delete todos. Status/isDone auto-sync.
Subtodos: created inline via the subtodos array. Title only — matches the UI which only allows entering a title.
Other fields (priority/dueDate/etc.) on a subtodo can be set later via a separate update action targeting the subtodo's id.
Links: linkItems / unlinkItems are supported only on top-level todos. Subtodos cannot be linked — link the parent todo instead, or convert the subtodo to top-level (clear parentId) first.`,
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
  },
  // ─── Schedules (calendar events) ──────────────────────────
  {
    name: 'list_schedules',
    description: `List calendar events (schedules) in the active workspace.
- from/to: ISO 8601 date range. If both omitted, returns all schedules.
- search: substring match on title/description/location (case-insensitive)`,
    schema: {
      from: z.string().optional().describe('ISO 8601 start of range'),
      to: z.string().optional().describe('ISO 8601 end of range'),
      search: z.string().optional().describe('Substring match on title/description/location')
    },
    handler: ({ from, to, search }) => {
      const params = new URLSearchParams()
      if (from) params.set('from', from as string)
      if (to) params.set('to', to as string)
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/schedules${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_schedules',
    description: `Batch create, update, or delete calendar events. allDay events are auto-normalized to 00:00–23:59.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              description: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              allDay: z.boolean().optional(),
              startAt: z.string().describe('ISO 8601'),
              endAt: z.string().describe('ISO 8601'),
              color: z.string().nullable().optional(),
              priority: z.enum(['low', 'medium', 'high']).optional()
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              allDay: z.boolean().optional(),
              startAt: z.string().optional(),
              endAt: z.string().optional(),
              color: z.string().nullable().optional(),
              priority: z.enum(['low', 'medium', 'high']).optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of schedule actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/schedules/batch', args)
  },
  // ─── Reminders ────────────────────────────────────────────
  {
    name: 'list_reminders',
    description: `List reminders. If entityType+entityId are given, returns reminders only for that entity; otherwise returns reminders for all todos and schedules in the active workspace.
pendingOnly=true filters out fired reminders.`,
    schema: {
      entityType: z
        .enum(['todo', 'schedule'])
        .optional()
        .describe('Required together with entityId to scope by entity'),
      entityId: z.string().optional(),
      pendingOnly: z.boolean().optional().describe('Only un-fired reminders (default: false)')
    },
    handler: ({ entityType, entityId, pendingOnly }) => {
      const params = new URLSearchParams()
      if (entityType) params.set('entityType', entityType as string)
      if (entityId) params.set('entityId', entityId as string)
      if (pendingOnly) params.set('pendingOnly', 'true')
      const qs = params.toString()
      return callTool('GET', `/api/mcp/reminders${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_reminders',
    description: `Create or delete reminders for todos/schedules.
offsetMs (create) must be one of: 600000 (10m), 1800000 (30m), 3600000 (1h), 86400000 (1d), 172800000 (2d).
Reminder fires (entity start/due time - offsetMs); creation throws if that moment is in the past.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              entityType: z.enum(['todo', 'schedule']),
              entityId: z.string(),
              offsetMs: z.number().int().positive()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of reminder actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/reminders/batch', args)
  },
  // ─── Recurring rules ──────────────────────────────────────
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
  },
  // ─── Templates ────────────────────────────────────────────
  {
    name: 'list_templates',
    description: `List note/csv templates in the active workspace.
- Without id: returns metadata list (jsonData omitted to save tokens).
- With id: returns the single template with full jsonData (the serialized payload — JSON string for note templates consumable by write_content's content field, CSV body for csv templates). When id is set, type filter is ignored.`,
    schema: {
      type: z.enum(['note', 'csv']).optional().describe('Filter by template type (ignored when id is set)'),
      id: z.string().optional().describe('When set, returns full content of that template instead of a list')
    },
    handler: ({ type, id }) => {
      if (typeof id === 'string' && id) {
        return callTool('GET', `/api/mcp/templates/${e(id)}`)
      }
      const params = new URLSearchParams()
      if (type) params.set('type', type as string)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/templates${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_templates',
    description: `Batch create or delete templates. Templates do not support update — delete + recreate to change content.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              type: z.enum(['note', 'csv']),
              jsonData: z.string().describe('Serialized template payload (markdown JSON or CSV)')
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of template actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/templates/batch', args)
  },
  // ─── Tags ─────────────────────────────────────────────────
  {
    name: 'list_tags',
    description: `List tags in the active workspace.
- search: substring match on name/description (workspace-wide listing)
- forItemType + forItemId: pass both to scope the response to tags attached to that specific item
  (overrides search). Item types: note, csv, canvas, todo, pdf, image, folder.`,
    schema: {
      search: z.string().optional(),
      forItemType: z
        .enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder'])
        .optional()
        .describe('Pair with forItemId to list tags attached to a specific item'),
      forItemId: z.string().optional().describe('Pair with forItemType')
    },
    handler: ({ search, forItemType, forItemId }) => {
      if (typeof forItemType === 'string' && typeof forItemId === 'string' && forItemId) {
        return callTool('GET', `/api/mcp/tagged/${e(forItemType)}/${e(forItemId)}`)
      }
      const params = new URLSearchParams()
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/tags${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'list_tagged_items',
    description: `List items that carry a given tag. Filter by itemTypes (default: all taggable types).
Orphan attachments (item deleted but tag link remains) are skipped from the response.`,
    schema: {
      tagId: z.string(),
      itemTypes: z
        .array(z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder']))
        .optional()
    },
    handler: ({ tagId, itemTypes }) => {
      const params = new URLSearchParams()
      if (Array.isArray(itemTypes) && itemTypes.length > 0) {
        for (const t of itemTypes as string[]) params.append('itemTypes[]', t)
      }
      const qs = params.toString()
      return callTool('GET', `/api/mcp/tags/${e(tagId as string)}/items${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_tags',
    description: `Batch tag operations:
- create_tag / update_tag / delete_tag: tag CRUD
- attach / detach: link a tag to a taggable item (note/csv/canvas/todo/pdf/image/folder)
delete_tag also detaches from all items.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create_tag'),
              name: z.string(),
              color: z.string().optional(),
              description: z.string().optional()
            }),
            z.object({
              action: z.literal('update_tag'),
              id: z.string(),
              name: z.string().optional(),
              color: z.string().optional(),
              description: z.string().nullable().optional()
            }),
            z.object({ action: z.literal('delete_tag'), id: z.string() }),
            z.object({
              action: z.literal('attach'),
              tagId: z.string(),
              itemType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder']),
              itemId: z.string()
            }),
            z.object({
              action: z.literal('detach'),
              tagId: z.string(),
              itemType: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'folder']),
              itemId: z.string()
            })
          ])
        )
        .describe('Array of tag actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/tags/batch', args)
  },
  // ─── History ──────────────────────────────────────────────
  {
    name: 'get_history',
    description: `List completed todos grouped by day (most recent first). Includes recurring completions too.
Pagination is by "day with activity" — dayOffset/dayLimit skip empty days. Use fromDate/toDate to constrain by absolute range.
query: case-insensitive substring on todo titles or linked file titles.`,
    schema: {
      dayOffset: z.number().int().min(0).optional().describe('Pagination offset in active days'),
      dayLimit: z.number().int().min(1).max(60).optional().describe('Days per page (default: 10)'),
      fromDate: z.string().optional().describe('YYYY-MM-DD inclusive lower bound'),
      toDate: z.string().optional().describe('YYYY-MM-DD inclusive upper bound'),
      query: z.string().optional()
    },
    handler: ({ dayOffset, dayLimit, fromDate, toDate, query }) => {
      const params = new URLSearchParams()
      if (typeof dayOffset === 'number') params.set('dayOffset', String(dayOffset))
      if (typeof dayLimit === 'number') params.set('dayLimit', String(dayLimit))
      if (fromDate) params.set('fromDate', fromDate as string)
      if (toDate) params.set('toDate', toDate as string)
      if (typeof query === 'string' && query.trim()) params.set('query', query)
      const qs = params.toString()
      return callTool('GET', `/api/mcp/history${qs ? `?${qs}` : ''}`)
    }
  },
  // ─── PDFs / Images ────────────────────────────────────────
  {
    name: 'list_files',
    description: `List PDF or image files in the active workspace.
- type: 'pdf' or 'image' (required)
- folderId/recursive filter scope; search matches title/description
- Pass folderId="null" for root-only`,
    schema: {
      type: z.enum(['pdf', 'image']).describe('File type to list'),
      folderId: z.string().optional().describe('Folder id to scope to. Pass "null" for root-only.'),
      recursive: z.boolean().optional().describe('Include all descendant folders (default: false)'),
      search: z.string().optional()
    },
    handler: ({ type, folderId, recursive, search }) => {
      const params = new URLSearchParams()
      if (typeof folderId === 'string') params.set('folderId', folderId)
      if (recursive) params.set('recursive', 'true')
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      const qs = params.toString()
      const endpoint = type === 'pdf' ? '/api/mcp/pdfs' : '/api/mcp/images'
      return callTool('GET', `${endpoint}${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_files',
    description: `Batch rename/move/update_meta/delete on PDF or image files. Importing new files requires the desktop UI (file dialog).
- type: 'pdf' or 'image' (required) — applies to all actions in this call`,
    schema: {
      type: z.enum(['pdf', 'image']).describe('File type the actions target'),
      actions: z
        .array(
          z.union([
            z.object({ action: z.literal('rename'), id: z.string(), newName: z.string() }),
            z.object({
              action: z.literal('move'),
              id: z.string(),
              targetFolderId: z.string().optional()
            }),
            z.object({
              action: z.literal('update_meta'),
              id: z.string(),
              description: z.string().optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of file actions')
    },
    handler: ({ type, ...rest }) => {
      const endpoint = type === 'pdf' ? '/api/mcp/pdfs/batch' : '/api/mcp/images/batch'
      return callTool('POST', endpoint, rest)
    }
  },
  // ─── Workspace info ───────────────────────────────────────
  {
    name: 'get_workspace_info',
    description: `Active workspace summary: id/name/path + cross-domain stats + recentActivity (note/table/canvas/todo, updatedAt desc).
Use this when you want a quick overview of the workspace without paging through list_items.

Lightweight stats-only mode: pass statsTypes (subset of count kinds) to skip recentActivity and return just the requested counts. Useful when you only need totals.`,
    schema: {
      recentLimit: z
        .number()
        .int()
        .min(0)
        .max(50)
        .optional()
        .describe('Number of recent activity entries (default: 10, max: 50). Ignored when statsTypes is set.'),
      statsTypes: z
        .array(
          z.enum([
            'folders',
            'notes',
            'tables',
            'canvases',
            'todos',
            'pdfs',
            'images',
            'schedules',
            'tags',
            'templates',
            'recurringRules'
          ])
        )
        .optional()
        .describe('When set, returns lightweight count-only stats for these kinds (no recentActivity). Pass [] not allowed — omit instead.')
    },
    handler: ({ recentLimit, statsTypes }) => {
      if (Array.isArray(statsTypes) && statsTypes.length > 0) {
        const params = new URLSearchParams()
        for (const t of statsTypes as string[]) params.append('types[]', t)
        return callTool('GET', `/api/mcp/workspace/stats?${params.toString()}`)
      }
      const params = new URLSearchParams()
      if (typeof recentLimit === 'number') params.set('recentLimit', String(recentLimit))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/workspace${qs ? `?${qs}` : ''}`)
    }
  },
  // ─── Trash ────────────────────────────────────────────────
  {
    name: 'list_trash',
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
                Object.entries(parsed as Record<string, unknown>).filter(([k]) => k !== '_workspace')
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
