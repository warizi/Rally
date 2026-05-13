/**
 * MCP items tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_items, search, read_contents, write_content, manage_items, manage_folders.
 * MCP v2 — browse 추가 (list_items + list_files + list_tagged_items + list_tags 통합).
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const itemsTools: ToolDefinition[] = [
  {
    name: 'browse',
    description: `Browse items (folders, notes, tables, csv, canvases, pdfs, images, tags) in the active workspace.
Unified discovery tool — replaces list_items + list_files + list_tagged_items + list_tags (workspace mode).
All filters are AND-combined:
- folderId + recursive: scope to a folder subtree (omit folderId for whole workspace; folderId="null" for root-level only)
- types: subset of ["folder","note","csv","canvas","pdf","image","tag"]; omit to include all
- tagId: only items carrying this tag
- linkedTo: { type, id } — only items linked to this entity (entity-link)
- search: substring match on title/name/description
- updatedAfter: ISO 8601 — items modified after this moment
- summary=true: strip heavy fields (preview / relativePath / folderPath / description)
- limit/offset: per-kind pagination (default 500, max 1000); response.meta.hasMore tells when to page

When types=["tag"], tag list is returned (substring search on name/description).
Response groups items by kind: { folders?, notes?, tables?, canvases?, pdfs?, images?, tags? } + meta.`,
    schema: {
      folderId: z.string().optional().describe('Folder id, "null" for root-only, omit for all'),
      recursive: z
        .boolean()
        .optional()
        .describe('When folderId is set, include all descendants (default: direct children only)'),
      types: z
        .array(z.enum(['folder', 'note', 'csv', 'canvas', 'pdf', 'image', 'tag']))
        .optional()
        .describe('Limit response to specific kinds. Omit to include all.'),
      tagId: z.string().optional().describe('Only items carrying this tag'),
      linkedTo: z
        .object({
          type: z.enum(['note', 'csv', 'canvas', 'todo', 'pdf', 'image', 'schedule']),
          id: z.string()
        })
        .optional()
        .describe('Only items linked to this entity (entity-link)'),
      search: z.string().optional().describe('Substring match on title/description'),
      updatedAfter: z
        .string()
        .optional()
        .describe('ISO 8601 timestamp — only items updated after this moment'),
      summary: z
        .boolean()
        .optional()
        .describe('Strip heavy fields (preview / relativePath / folderPath / description)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe('Per-kind row cap (default 500, max 1000)'),
      offset: z.number().int().min(0).optional().describe('Per-kind offset for pagination')
    },
    handler: ({
      folderId,
      recursive,
      types,
      tagId,
      linkedTo,
      search,
      updatedAfter,
      summary,
      limit,
      offset
    }) => {
      const params = new URLSearchParams()
      if (typeof folderId === 'string') params.set('folderId', folderId)
      if (recursive) params.set('recursive', 'true')
      if (summary) params.set('summary', 'true')
      if (Array.isArray(types) && types.length > 0) {
        for (const t of types as string[]) params.append('types[]', t)
      }
      if (typeof tagId === 'string' && tagId) params.set('tagId', tagId)
      if (linkedTo && typeof linkedTo === 'object') {
        const lt = linkedTo as { type: string; id: string }
        params.set('linkedTo[type]', lt.type)
        params.set('linkedTo[id]', lt.id)
      }
      if (typeof search === 'string' && search.trim()) params.set('search', search)
      if (updatedAfter) params.set('updatedAfter', updatedAfter as string)
      if (typeof limit === 'number') params.set('limit', String(limit))
      if (typeof offset === 'number') params.set('offset', String(offset))
      const qs = params.toString()
      return callTool('GET', `/api/mcp/browse${qs ? `?${qs}` : ''}`)
    }
  },
  {
    name: 'manage_content',
    description: `Batch create/update note or csv content. Replaces v1 write_content with array of actions.

Actions:
- create: { action:'create', type:'note'|'table', title, folderId?, content }
- update: { action:'update', id, content?, title? }

Per-entry result independent (one failure doesn't roll back others).
For delete: use manage_items.delete (soft-delete to trash).

WARNING: When updating note content, image references (![](/.images/xxx.png)) removed from new content
will be permanently deleted from disk. Always preserve existing image references.`,
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              type: z.enum(['note', 'table']),
              title: z.string(),
              folderId: z.string().optional(),
              content: z.string()
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              content: z.string().optional(),
              title: z.string().optional()
            })
          ])
        )
        .describe('Array of create/update actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/content/batch', args)
  },
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
  }
]
