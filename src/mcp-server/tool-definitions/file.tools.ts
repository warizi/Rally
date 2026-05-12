/**
 * MCP file tools.
 * P3-7 — tool-definitions.ts 분할. 포함: list_files, manage_files.
 */
import { z } from 'zod'
import { callTool } from '../lib/call-tool'
import type { ToolDefinition } from './types'

export const fileTools: ToolDefinition[] = [
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
  }
  // ─── Workspace info ───────────────────────────────────────
]
