import type { Router } from '../../router'
import type {
  SearchNotesResponse,
  NoteContentResponse,
  TableContentResponse,
  WriteContentBody,
  WriteContentResult
} from './types'
import { noteRepository } from '../../../repositories/note'
import { csvFileRepository } from '../../../repositories/csv-file'
import { noteService } from '../../../services/note'
import { csvFileService } from '../../../services/csv-file'
import { ValidationError } from '../../../lib/errors'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, resolveItemType } from './helpers'

export function registerMcpContentRoutes(router: Router): void {
  // ─── GET /api/mcp/notes/search → search_notes ─────────────

  router.addRoute(
    'GET',
    '/api/mcp/notes/search',
    async (_params, _body, query): Promise<SearchNotesResponse> => {
      const wsId = resolveActiveWorkspace()
      const q = query.get('q') || ''
      if (!q.trim()) return { results: [] }
      const results = await noteService.search(wsId, q)
      return { results }
    }
  )

  // ─── GET /api/mcp/content/:id → read_content ──────────────

  router.addRoute(
    'GET',
    '/api/mcp/content/:id',
    (params): NoteContentResponse | TableContentResponse => {
      const wsId = resolveActiveWorkspace()
      const resolved = resolveItemType(params.id)

      if (resolved.type === 'note') {
        const content = noteService.readContent(wsId, params.id)
        return {
          type: 'note',
          title: resolved.row.title,
          relativePath: resolved.row.relativePath,
          content
        }
      } else {
        const { content, encoding, columnWidths } = csvFileService.readContent(wsId, params.id)
        return {
          type: 'table',
          title: resolved.row.title,
          relativePath: resolved.row.relativePath,
          content,
          encoding,
          columnWidths
        }
      }
    }
  )

  // ─── POST /api/mcp/content → write_content ────────────────

  router.addRoute<WriteContentBody>('POST', '/api/mcp/content', (_, body): WriteContentResult => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()

    if (body.id) {
      const { type, row } = resolveItemType(body.id)
      if (type === 'note') {
        noteService.writeContent(wsId, body.id, body.content)
        broadcastChanged('note:changed', wsId, [row.relativePath])
      } else {
        csvFileService.writeContent(wsId, body.id, body.content)
        broadcastChanged('csv:changed', wsId, [row.relativePath])
      }
      const updated =
        type === 'note' ? noteRepository.findById(body.id) : csvFileRepository.findById(body.id)
      return {
        type,
        id: body.id,
        title: updated!.title,
        relativePath: updated!.relativePath,
        created: false
      }
    } else {
      if (!body.type) throw new ValidationError('type is required for create')
      if (!body.title) throw new ValidationError('title is required for create')
      const folderId = body.folderId ?? null

      if (body.type === 'note') {
        const result = noteService.create(wsId, folderId, body.title)
        if (body.content) noteService.writeContent(wsId, result.id, body.content)
        broadcastChanged('note:changed', wsId, [result.relativePath])
        return {
          type: 'note',
          id: result.id,
          title: result.title,
          relativePath: result.relativePath,
          created: true
        }
      } else {
        const result = csvFileService.create(wsId, folderId, body.title)
        if (body.content) csvFileService.writeContent(wsId, result.id, body.content)
        broadcastChanged('csv:changed', wsId, [result.relativePath])
        return {
          type: 'table',
          id: result.id,
          title: result.title,
          relativePath: result.relativePath,
          created: true
        }
      }
    }
  })
}
