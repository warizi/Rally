/**
 * MCP items tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_items, search, read_contents, write_content, manage_items, manage_folders.
 * MCP v2 — browse + read 추가 (list_items/files/tagged/tags + read_contents/read_canvas/list_templates(id) 통합).
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
    name: 'read',
    description: `Batch read item bodies/metadata by id (1–50). Type is auto-detected from id.

Supported types and response shape per entry:
- note     : { id, success:true, type:'note',     title, relativePath, content }
- csv      : { id, success:true, type:'csv',      title, relativePath, content, encoding, columnWidths }
- canvas   : { id, success:true, type:'canvas',   title, description, nodes, edges, createdAt, updatedAt }
- pdf      : { id, success:true, type:'pdf',      title, relativePath, description, folderId, createdAt,
              updatedAt, size, pageCount, text, truncated }
- image    : { id, success:true, type:'image',    title, relativePath, description, folderId, createdAt,
              updatedAt, size, mimeType, content (base64) | null, truncated }
- template : { id, success:true, type:'template', title, templateType, jsonData, createdAt }

Image/PDF bodies are returned by default:
- image.content is base64 (use mimeType to decode). Files larger than 1MB return content=null + truncated=true.
- pdf.text is extracted with pdfjs. Default caps: first 10 pages and 100,000 chars (truncated=true if hit).
- Pass includeImageContent=false to fetch image metadata only (faster, smaller response).
- Pass includePdfText=false to fetch PDF metadata only (pageCount + size, no text).
- Override caps via maxPdfPages / maxPdfChars.

Failure entries: { id, success:false, error: { code, message } } — independent per id, others still succeed.

Replaces v1 read_contents (note/csv), read_canvas, list_templates(id). Mixed type ids in one call OK.`,
    schema: {
      ids: z.array(z.string()).min(1).max(50).describe('Mixed-type item IDs (1–50)'),
      includeImageContent: z
        .boolean()
        .optional()
        .describe('Include base64 image bodies (default true). Set false for metadata-only.'),
      includePdfText: z
        .boolean()
        .optional()
        .describe('Extract PDF text via pdfjs (default true). Set false for metadata-only.'),
      maxPdfPages: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max PDF pages to extract per file (default 10).'),
      maxPdfChars: z
        .number()
        .int()
        .min(1)
        .max(500_000)
        .optional()
        .describe('Max characters of extracted PDF text per file (default 100_000).')
    },
    handler: (args) => callTool('POST', '/api/mcp/read', args)
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
    name: 'manage_items',
    description: `Batch rename/move/delete/create_folder/update_meta on any workspace item.
Type is auto-detected from id — supports note / csv / canvas / pdf / image / folder.

Actions:
- rename: { action:'rename', id, newName }
- move: { action:'move', id, targetFolderId? }
- delete: { action:'delete', id } — soft delete (recoverable via manage_trash)
- create_folder: { action:'create_folder', name, parentFolderId? }
- update_meta: { action:'update_meta', id, description? } — pdf/image only

MCP v2: replaces v1 manage_items (note/csv) + manage_folders + manage_files. Backward-compatible expansion.`,
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
            z.object({ action: z.literal('delete'), id: z.string() }),
            z.object({
              action: z.literal('create_folder'),
              name: z.string(),
              parentFolderId: z.string().optional()
            }),
            z.object({
              action: z.literal('update_meta'),
              id: z.string(),
              description: z.string().optional()
            })
          ])
        )
        .describe('Array of actions (rename/move/delete/create_folder/update_meta)')
    },
    handler: (args) => callTool('POST', '/api/mcp/manage-items/batch', args)
  }
]
