import path from 'path'
import { NotFoundError, ValidationError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import { folderRepository } from '../repositories/folder'
import { noteService } from './note'
import { csvFileService } from './csv-file'
import { canvasService } from './canvas'
import { todoService } from './todo'

export type SearchType = 'note' | 'table' | 'canvas' | 'todo'

export interface SearchOptions {
  /** 검색 도메인. 미지정 시 ['note'] (기존 search_notes 호환) */
  types?: SearchType[]
  /** 페이지 시작 (default: 0) */
  offset?: number
  /** 페이지당 결과 (default: 50, max: 100) */
  limit?: number
  /** excerpt 추출 여부 (default: false) */
  highlight?: boolean
}

export interface SearchHit {
  type: SearchType
  id: string
  title: string
  matchType: 'title' | 'content' | 'description'
  folderId: string | null
  folderPath: string | null
  updatedAt: string
  preview: string | null
  excerpt?: string
}

export interface SearchResult {
  query: string
  results: SearchHit[]
  total: number
  hasMore: boolean
  nextOffset: number
  meta: {
    types: SearchType[]
    offset: number
    limit: number
    perTypeCounts: Record<SearchType, number>
  }
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const EXCERPT_PAD = 50

const VALID_TYPES: ReadonlySet<SearchType> = new Set(['note', 'table', 'canvas', 'todo'])

function buildExcerpt(text: string | null | undefined, query: string): string | undefined {
  if (!text) return undefined
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return undefined
  const start = Math.max(0, idx - EXCERPT_PAD)
  const end = Math.min(text.length, idx + query.length + EXCERPT_PAD)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`.replace(/\s+/g, ' ').trim()
}

export const searchService = {
  async search(
    workspaceId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const { types = ['note'], offset = 0, limit = DEFAULT_LIMIT, highlight = false } = options

    if (offset < 0) throw new ValidationError('offset must be >= 0')
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`)
    }
    if (types.length === 0) throw new ValidationError('types must not be empty')
    for (const t of types) {
      if (!VALID_TYPES.has(t)) {
        throw new ValidationError(`Invalid search type: ${t}`)
      }
    }

    const trimmed = query.trim()
    const emptyResult: SearchResult = {
      query,
      results: [],
      total: 0,
      hasMore: false,
      nextOffset: offset,
      meta: {
        types,
        offset,
        limit,
        perTypeCounts: { note: 0, table: 0, canvas: 0, todo: 0 }
      }
    }
    if (!trimmed) return emptyResult

    // ── folder map (folderPath 리졸브용) ──────────────────────
    const folders = folderRepository.findByWorkspaceId(workspaceId)
    const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

    // ── 도메인별 수집 ────────────────────────────────────────
    const hits: SearchHit[] = []
    const perTypeCounts: Record<SearchType, number> = {
      note: 0,
      table: 0,
      canvas: 0,
      todo: 0
    }

    if (types.includes('note')) {
      const notes = await noteService.search(workspaceId, trimmed)
      perTypeCounts.note = notes.length
      for (const n of notes) {
        const hit: SearchHit = {
          type: 'note',
          id: n.id,
          title: n.title,
          matchType: n.matchType,
          folderId: n.folderId,
          folderPath: n.folderId
            ? (folderMap.get(n.folderId) ?? extractFolderPath(n.relativePath))
            : extractFolderPath(n.relativePath),
          updatedAt: n.updatedAt.toISOString(),
          preview: n.preview ?? null
        }
        if (highlight) {
          hit.excerpt =
            buildExcerpt(n.preview, trimmed) ?? buildExcerpt(n.title, trimmed) ?? undefined
        }
        hits.push(hit)
      }
    }

    if (types.includes('table')) {
      const tables = csvFileService.search(workspaceId, trimmed)
      perTypeCounts.table = tables.length
      for (const t of tables) {
        const hit: SearchHit = {
          type: 'table',
          id: t.id,
          title: t.title,
          matchType: t.matchType,
          folderId: t.folderId,
          folderPath: t.folderId ? (folderMap.get(t.folderId) ?? null) : null,
          updatedAt: t.updatedAt.toISOString(),
          preview: t.preview ?? null
        }
        if (highlight) {
          hit.excerpt =
            buildExcerpt(t.preview, trimmed) ?? buildExcerpt(t.title, trimmed) ?? undefined
        }
        hits.push(hit)
      }
    }

    if (types.includes('canvas')) {
      const canvases = canvasService.search(workspaceId, trimmed)
      perTypeCounts.canvas = canvases.length
      for (const c of canvases) {
        const hit: SearchHit = {
          type: 'canvas',
          id: c.id,
          title: c.title,
          matchType: c.matchType,
          folderId: null,
          folderPath: null,
          updatedAt: c.updatedAt.toISOString(),
          preview: c.description || null
        }
        if (highlight) {
          hit.excerpt =
            buildExcerpt(c.description, trimmed) ?? buildExcerpt(c.title, trimmed) ?? undefined
        }
        hits.push(hit)
      }
    }

    if (types.includes('todo')) {
      const todos = todoService.search(workspaceId, trimmed)
      perTypeCounts.todo = todos.length
      for (const t of todos) {
        const hit: SearchHit = {
          type: 'todo',
          id: t.id,
          title: t.title,
          matchType: t.matchType,
          folderId: null,
          folderPath: null,
          updatedAt: t.updatedAt.toISOString(),
          preview: t.description || null
        }
        if (highlight) {
          hit.excerpt =
            buildExcerpt(t.description, trimmed) ?? buildExcerpt(t.title, trimmed) ?? undefined
        }
        hits.push(hit)
      }
    }

    // ── 정렬: title 매칭 우선 → updatedAt desc ────────────────
    hits.sort((a, b) => {
      const aTitle = a.matchType === 'title' ? 0 : 1
      const bTitle = b.matchType === 'title' ? 0 : 1
      if (aTitle !== bTitle) return aTitle - bTitle
      return b.updatedAt.localeCompare(a.updatedAt)
    })

    const total = hits.length
    const sliced = hits.slice(offset, offset + limit)
    return {
      query,
      results: sliced,
      total,
      hasMore: offset + sliced.length < total,
      nextOffset: offset + sliced.length,
      meta: { types, offset, limit, perTypeCounts }
    }
  }
}

function extractFolderPath(relativePath: string): string | null {
  const dir = path.dirname(relativePath)
  if (!dir || dir === '.') return null
  // path.dirname는 native sep을 안 쓰지만 입력이 항상 `/` 분리이므로 그대로 반환
  return dir
}
