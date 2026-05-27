/**
 * MCP items tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_items, search, read_contents, write_content, manage_items, manage_folders.
 * MCP v2 — browse + read 추가 (list_items/files/tagged/tags + read_contents/read_canvas/list_templates(id) 통합).
 */
import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

type ContentBlock = CallToolResult['content'][number]

/**
 * callTool 의 단일 text 응답을 파싱해서 mutator 가 만들어주는 추가 image content block 들을
 * 함께 반환한다. 결과는 [text(JSON), ...images] 순서. 실패/에러 시 원본 그대로 반환.
 *
 * mutator 는 파싱된 JSON 을 받아 `sanitized` (응답 JSON 에서 base64 를 제거한 버전) 와
 * `images` (별도 image block 으로 분리할 항목 배열) 를 돌려준다.
 */
async function callToolWithImages(
  method: 'GET' | 'POST',
  urlPath: string,
  args: Record<string, unknown>,
  mutator: (parsed: Record<string, unknown>) => {
    sanitized: Record<string, unknown>
    images: { data: string; mimeType: string }[]
  }
): Promise<CallToolResult> {
  const raw = await callTool(method, urlPath, args)
  const first = raw.content?.[0]
  if (raw.isError || !first || first.type !== 'text' || typeof first.text !== 'string') {
    return raw
  }
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(first.text) as Record<string, unknown>
  } catch {
    return raw
  }
  const { sanitized, images } = mutator(parsed)
  const content: ContentBlock[] = [{ type: 'text', text: JSON.stringify(sanitized, null, 2) }]
  for (const img of images) {
    content.push({ type: 'image', data: img.data, mimeType: img.mimeType })
  }
  return { content }
}

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
- note     : { id, success:true, type:'note',     title, relativePath, content, embeddedImages }
             embeddedImages: [{ src, size, mimeType }] — pointers to .images/ files in the note body.
             Fetch the bytes separately with the read_note_image tool when needed.
             Note bodies may also contain Obsidian-style cross-item embeds in the markdown:
               ![[note:<id>]]              — embed another note as inline link
               ![[csv:<id>|h=<px>]]        — embed a csv (h: container height, omit for content-fit)
               ![[pdf:<id>|h=<px>]]        — embed a pdf
               ![[image:<id>|h=<px>]]      — embed an image-file (workspace library, not inline .images/)
             Use the embedded id with read again to fetch the linked item's content.
- csv      : { id, success:true, type:'csv',      title, relativePath, content, encoding, columnWidths }
- canvas   : { id, success:true, type:'canvas',   title, description, nodes, edges, createdAt, updatedAt }
- pdf      : { id, success:true, type:'pdf',      title, relativePath, description, folderId, createdAt,
              updatedAt, size, pageCount, text, truncated, pageImages, pageImagesTruncated }
- image    : { id, success:true, type:'image',    title, relativePath, description, folderId, createdAt,
              updatedAt, size, mimeType, content (base64) | null, truncated }
- template : { id, success:true, type:'template', title, templateType, jsonData, createdAt }

Image/PDF bodies are returned by default:
- image.content is base64 (use mimeType to decode). Files larger than 1MB return content=null + truncated=true.
- pdf.text is extracted with pdfjs. Default caps: first 10 pages and 100,000 chars (truncated=true if hit).
- pdf.pageImages renders pages to PNG base64 — by default 'auto' fallback: only triggered when text extraction
  returns nearly empty (scanned PDFs / image-only PDFs). Set renderPdfPages='always' to also render even when
  text exists, or 'never' to disable. Default cap: first 3 pages at scale 1.5 (pageImagesTruncated=true if hit).
- Pass includeImageContent=false to fetch image metadata only (faster, smaller response).
- Pass includePdfText=false to fetch PDF metadata only (pageCount + size, no text).
- Override caps via maxPdfPages / maxPdfChars / maxPdfPageImages / pdfImageScale.

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
        .describe('Max characters of extracted PDF text per file (default 100_000).'),
      renderPdfPages: z
        .enum(['auto', 'always', 'never'])
        .optional()
        .describe(
          "Render PDF pages to PNG base64. 'auto' (default) = render only when text is nearly empty; 'always' = render even with text; 'never' = skip."
        ),
      maxPdfPageImages: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Max PDF pages to render as images per file (default 3).'),
      pdfImageScale: z
        .number()
        .min(0.5)
        .max(3)
        .optional()
        .describe('pdfjs viewport scale for rendered page images (default 1.5).')
    },
    handler: (args) =>
      callToolWithImages('POST', '/api/mcp/read', args as Record<string, unknown>, (parsed) => {
        // image.content / pdf.pageImages[].data 를 별도 image content block 으로 분리해서
        // Claude Code 가 multimodal input 으로 LLM 에게 직접 전달하도록 한다.
        // JSON 안 base64 는 LLM 이 텍스트로만 인식하므로 그림으로 못 본다.
        const results = Array.isArray(parsed.results) ? parsed.results : []
        const images: { data: string; mimeType: string }[] = []
        const sanitizedResults = results.map((r: unknown) => {
          if (!r || typeof r !== 'object') return r
          const entry = r as Record<string, unknown>
          if (
            entry.type === 'image' &&
            typeof entry.content === 'string' &&
            typeof entry.mimeType === 'string'
          ) {
            images.push({ data: entry.content, mimeType: entry.mimeType })
            return { ...entry, content: '[embedded as image content block in this response]' }
          }
          if (entry.type === 'pdf' && Array.isArray(entry.pageImages) && entry.pageImages.length) {
            for (const pi of entry.pageImages as Array<Record<string, unknown>>) {
              if (typeof pi.data === 'string' && typeof pi.mimeType === 'string') {
                images.push({ data: pi.data, mimeType: pi.mimeType })
              }
            }
            return {
              ...entry,
              pageImages: (entry.pageImages as Array<Record<string, unknown>>).map((pi) => ({
                page: pi.page,
                mimeType: pi.mimeType,
                embedded: true
              }))
            }
          }
          return entry
        })
        return { sanitized: { ...parsed, results: sanitizedResults }, images }
      })
  },
  {
    name: 'read_note_image',
    description: `Read a single image embedded in a note body as base64.

A note's response includes embeddedImages with { src, size, mimeType } for each .images/...
reference found in the markdown. The bytes are NOT returned by 'read' to keep responses small —
call this tool with the same { noteId, src } pair to fetch a single image on demand.

Response: { src, data (base64) | null, mimeType, size, truncated }
- Files larger than 1MB return data=null + truncated=true (to fit MCP result size limits).`,
    schema: {
      noteId: z.string().describe('Note id (must belong to the active workspace).'),
      src: z
        .string()
        .describe(
          'Image src from note.embeddedImages[].src (e.g. ".images/abc.png"). Must be under .images/.'
        )
    },
    handler: (args) =>
      callToolWithImages(
        'POST',
        '/api/mcp/note-images/read',
        args as Record<string, unknown>,
        (parsed) => {
          // data(base64) 는 image content block 으로 빼서 LLM 이 그림으로 직접 본다.
          // JSON 메타(src/size/mimeType/truncated) 는 text block 에 남긴다.
          if (typeof parsed.data === 'string' && typeof parsed.mimeType === 'string') {
            const { data, ...rest } = parsed
            return {
              sanitized: { ...rest, data: '[embedded as image content block in this response]' },
              images: [{ data: data as string, mimeType: parsed.mimeType as string }]
            }
          }
          return { sanitized: parsed, images: [] }
        }
      )
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
will be permanently deleted from disk. Always preserve existing image references.

Note content can also include Obsidian-style cross-item embeds — keep / insert them verbatim:
  ![[note:<id>]]   ![[csv:<id>|h=<px>]]   ![[pdf:<id>|h=<px>]]   ![[image:<id>|h=<px>]]
h is optional and only sets the container height in the editor; omit to use content-fit (csv/note) or
domain default (pdf 600 / image 400). Use ids returned by browse/search.`,
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
