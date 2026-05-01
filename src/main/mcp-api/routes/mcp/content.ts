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
import { searchService, type SearchType } from '../../../services/search'
import { ValidationError } from '../../../lib/errors'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, resolveItemType, assertValidId } from './helpers'

const VALID_SEARCH_TYPES: ReadonlySet<SearchType> = new Set(['note', 'table', 'canvas', 'todo'])

function parseSearchTypes(query: URLSearchParams): SearchType[] {
  const csv = query.get('types')
  const repeat = query.getAll('types[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return ['note']
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return ['note']
  for (const t of cleaned) {
    if (!VALID_SEARCH_TYPES.has(t as SearchType)) {
      throw new ValidationError(`Invalid type: ${t}. Must be one of note, table, canvas, todo.`)
    }
  }
  return cleaned as SearchType[]
}

function parseNonNegInt(raw: string | null, label: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || `${n}` !== raw) {
    throw new ValidationError(`${label} must be a non-negative integer`)
  }
  return n
}

export function registerMcpContentRoutes(router: Router): void {
  // ─── GET /api/mcp/notes/search → search_notes (legacy) ────
  // 호환성: 기존 호출자(레거시 search_notes 도구 등)가 의존하는 응답 형식 유지.
  // 통합 검색은 GET /api/mcp/search 사용.

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

  // ─── GET /api/mcp/search → search (통합) ──────────────────

  router.addRoute('GET', '/api/mcp/search', async (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const q = query.get('q') || ''
    const types = parseSearchTypes(query)
    const offset = parseNonNegInt(query.get('offset'), 'offset')
    const limit = parseNonNegInt(query.get('limit'), 'limit')
    const highlight = query.get('highlight') === 'true'
    return searchService.search(wsId, q, { types, offset, limit, highlight })
  })

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

  // ─── POST /api/mcp/contents/batch → read_contents ─────────
  // 부분 실패 처리: 한 ID 실패해도 results[i]에 error를 채우고 진행.
  // 트랜잭션 불필요(read-only) — processBatchActions는 mutation 전용이라 직접 루프.

  router.addRoute<{ ids: string[] }>('POST', '/api/mcp/contents/batch', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new ValidationError('ids array is required')
    }
    if (body.ids.length > 50) {
      throw new ValidationError(`Batch size ${body.ids.length} exceeds limit 50.`)
    }

    type ReadContentResult =
      | {
          id: string
          success: true
          type: 'note'
          title: string
          relativePath: string
          content: string
        }
      | {
          id: string
          success: true
          type: 'table'
          title: string
          relativePath: string
          content: string
          encoding: string
          columnWidths: string | null
        }
      | {
          id: string
          success: false
          error: { code: string; message: string }
        }

    const results: ReadContentResult[] = body.ids.map((id) => {
      try {
        assertValidId(id, 'id')
        const resolved = resolveItemType(id)
        if (resolved.type === 'note') {
          const content = noteService.readContent(wsId, id)
          return {
            id,
            success: true,
            type: 'note',
            title: resolved.row.title,
            relativePath: resolved.row.relativePath,
            content
          }
        }
        const { content, encoding, columnWidths } = csvFileService.readContent(wsId, id)
        return {
          id,
          success: true,
          type: 'table',
          title: resolved.row.title,
          relativePath: resolved.row.relativePath,
          content,
          encoding,
          columnWidths
        }
      } catch (e) {
        const err = e as Error
        return {
          id,
          success: false,
          error: { code: err.constructor.name, message: err.message }
        }
      }
    })

    return { results }
  })

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
        // body.content 쓰기 실패 시 방금 생성한 빈 노트를 정리하여 orphan 파일/DB row 방지
        if (body.content) {
          try {
            noteService.writeContent(wsId, result.id, body.content)
          } catch (e) {
            try {
              noteService.remove(wsId, result.id)
            } catch {
              // 정리 실패는 무시 — 원래 에러를 우선 보존
            }
            throw e
          }
        }
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
        if (body.content) {
          try {
            csvFileService.writeContent(wsId, result.id, body.content)
          } catch (e) {
            try {
              csvFileService.remove(wsId, result.id)
            } catch {
              // 정리 실패는 무시
            }
            throw e
          }
        }
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
