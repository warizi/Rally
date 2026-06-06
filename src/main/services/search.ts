import path from 'path'
import { and, inArray, isNull } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '../lib/errors'
import { db, rawSqlite, vecEnabled } from '../db'
import { notes, csvFiles, canvases, todos } from '../db/schema'
import { workspaceRepository } from '../repositories/workspace'
import { folderRepository } from '../repositories/folder'
import { noteService } from './note'
import { csvFileService } from './csv-file'
import { canvasService } from './canvas'
import { todoService } from './todo'
import { embed } from './embedding-model'
import { scoped } from '../lib/logger'
import type { EmbeddableEntityType } from '../db/schema/embedding'

const log = scoped('search')

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
  /**
   * 검색 모드 (default: 'hybrid' — vec 비활성 시 자동 'keyword' 폴백).
   * - 'semantic': 벡터(의미) 검색만
   * - 'keyword': FTS5/substring(키워드) 검색만
   * - 'hybrid': 둘을 RRF로 융합
   */
  mode?: 'semantic' | 'keyword' | 'hybrid'
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
// 융합 전 각 검색기가 모을 후보 수
const CANDIDATE_K = 120
// RRF 상수 (작을수록 상위 랭크에 가중)
const RRF_K = 60

const VALID_TYPES: ReadonlySet<SearchType> = new Set(['note', 'table', 'canvas', 'todo'])

// SearchType ↔ 임베딩 엔티티 타입 매핑 (table === csv)
const SEARCH_TO_ENTITY: Record<SearchType, EmbeddableEntityType> = {
  note: 'note',
  table: 'csv',
  canvas: 'canvas',
  todo: 'todo'
}
const ENTITY_TO_SEARCH: Partial<Record<EmbeddableEntityType, SearchType>> = {
  note: 'note',
  csv: 'table',
  canvas: 'canvas',
  todo: 'todo'
}

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

function extractFolderPath(relativePath: string): string | null {
  const dir = path.dirname(relativePath)
  if (!dir || dir === '.') return null
  return dir
}

function emptyResult(
  query: string,
  opts: Required<Pick<SearchOptions, 'offset' | 'limit'>> & { types: SearchType[] }
): SearchResult {
  return {
    query,
    results: [],
    total: 0,
    hasMore: false,
    nextOffset: opts.offset,
    meta: {
      types: opts.types,
      offset: opts.offset,
      limit: opts.limit,
      perTypeCounts: { note: 0, table: 0, canvas: 0, todo: 0 }
    }
  }
}

// ── 메타데이터 일괄 조회 (활성 엔티티만) ──────────────────────────
interface EntityMeta {
  title: string
  folderId: string | null
  relativePath: string | null
  preview: string | null
  updatedAt: Date
}

function fetchMetaByType(
  type: SearchType,
  ids: string[],
  folderMap: Map<string, string>
): Map<string, EntityMeta> {
  const out = new Map<string, EntityMeta>()
  if (ids.length === 0) return out

  if (type === 'note') {
    const rows = db
      .select({
        id: notes.id,
        title: notes.title,
        folderId: notes.folderId,
        relativePath: notes.relativePath,
        preview: notes.preview,
        updatedAt: notes.updatedAt
      })
      .from(notes)
      .where(and(inArray(notes.id, ids), isNull(notes.deletedAt)))
      .all()
    for (const r of rows) {
      out.set(r.id, {
        title: r.title,
        folderId: r.folderId,
        relativePath: r.relativePath,
        preview: r.preview ?? null,
        updatedAt: r.updatedAt
      })
    }
  } else if (type === 'table') {
    const rows = db
      .select({
        id: csvFiles.id,
        title: csvFiles.title,
        folderId: csvFiles.folderId,
        preview: csvFiles.preview,
        updatedAt: csvFiles.updatedAt
      })
      .from(csvFiles)
      .where(and(inArray(csvFiles.id, ids), isNull(csvFiles.deletedAt)))
      .all()
    for (const r of rows) {
      out.set(r.id, {
        title: r.title,
        folderId: r.folderId,
        relativePath: null,
        preview: r.preview ?? null,
        updatedAt: r.updatedAt
      })
    }
  } else if (type === 'canvas') {
    const rows = db
      .select({
        id: canvases.id,
        title: canvases.title,
        description: canvases.description,
        updatedAt: canvases.updatedAt
      })
      .from(canvases)
      .where(and(inArray(canvases.id, ids), isNull(canvases.deletedAt)))
      .all()
    for (const r of rows) {
      out.set(r.id, {
        title: r.title,
        folderId: null,
        relativePath: null,
        preview: r.description || null,
        updatedAt: r.updatedAt
      })
    }
  } else {
    const rows = db
      .select({
        id: todos.id,
        title: todos.title,
        description: todos.description,
        updatedAt: todos.updatedAt
      })
      .from(todos)
      .where(and(inArray(todos.id, ids), isNull(todos.deletedAt)))
      .all()
    for (const r of rows) {
      out.set(r.id, {
        title: r.title,
        folderId: null,
        relativePath: null,
        preview: r.description || null,
        updatedAt: r.updatedAt
      })
    }
  }
  // folderPath 보정은 호출부에서 folderMap으로
  void folderMap
  return out
}

// ── 후보 검색기 (entity ref 리스트 반환, 랭크 순) ────────────────
interface Ref {
  type: SearchType
  id: string
}

/** FTS5 키워드 검색 → bm25 오름차순(좋은 순) ref 리스트 */
function ftsCandidates(query: string, entityTypes: Set<EmbeddableEntityType>): Ref[] {
  try {
    // trigram: 따옴표로 감싸 구문(phrase) 검색. 내부 따옴표 이스케이프.
    const matchExpr = `"${query.replace(/"/g, '""')}"`
    const rows = rawSqlite
      .prepare(
        `SELECT entity_type AS type, entity_id AS id, bm25(search_fts) AS score
         FROM search_fts
         WHERE search_fts MATCH ?
         ORDER BY score
         LIMIT ?`
      )
      .all(matchExpr, CANDIDATE_K) as { type: string; id: string; score: number }[]
    const out: Ref[] = []
    for (const r of rows) {
      const st = ENTITY_TO_SEARCH[r.type as EmbeddableEntityType]
      if (st && entityTypes.has(r.type as EmbeddableEntityType)) out.push({ type: st, id: r.id })
    }
    return out
  } catch (e) {
    log.warn('FTS query failed', e)
    return []
  }
}

/** 벡터(의미) 검색 → distance 오름차순(좋은 순) ref 리스트, 엔티티당 최선 1개 */
async function vectorCandidates(
  query: string,
  entityTypes: Set<EmbeddableEntityType>
): Promise<Ref[]> {
  if (!vecEnabled) return []
  let queryVec: number[]
  try {
    ;[queryVec] = await embed([query], 'query')
  } catch (e) {
    log.warn('query embedding failed', e)
    return []
  }
  const buf = Buffer.from(new Float32Array(queryVec).buffer)
  // KNN은 vec0 가상 테이블에 직접 LIMIT을 걸어야 하므로 CTE로 먼저 수행 후 JOIN.
  const rows = rawSqlite
    .prepare(
      `WITH knn AS (
         SELECT rowid, distance FROM vec_embeddings
         WHERE embedding MATCH ? ORDER BY distance LIMIT ?
       )
       SELECT k.distance AS distance, m.entity_type AS type, m.entity_id AS id
       FROM knn k JOIN embedding_meta m ON m.rowid = k.rowid
       ORDER BY k.distance`
    )
    .all(buf, CANDIDATE_K) as { distance: number; type: string; id: string }[]

  const seen = new Set<string>()
  const out: Ref[] = []
  for (const r of rows) {
    const et = r.type as EmbeddableEntityType
    const st = ENTITY_TO_SEARCH[et]
    if (!st || !entityTypes.has(et)) continue
    const key = `${st}:${r.id}`
    if (seen.has(key)) continue // 엔티티당 최선(최소 distance) 1개
    seen.add(key)
    out.push({ type: st, id: r.id })
  }
  return out
}

/** Reciprocal Rank Fusion — 여러 랭크 리스트를 단일 점수로 융합 */
function rrfFuse(lists: Ref[][]): Ref[] {
  const scores = new Map<string, { ref: Ref; score: number }>()
  for (const list of lists) {
    list.forEach((ref, rank) => {
      const key = `${ref.type}:${ref.id}`
      const entry = scores.get(key) ?? { ref, score: 0 }
      entry.score += 1 / (RRF_K + rank)
      scores.set(key, entry)
    })
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).map((e) => e.ref)
}

export const searchService = {
  async search(
    workspaceId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const {
      types = ['note'],
      offset = 0,
      limit = DEFAULT_LIMIT,
      highlight = false,
      mode = 'hybrid'
    } = options

    if (offset < 0) throw new ValidationError('offset must be >= 0')
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`)
    }
    if (types.length === 0) throw new ValidationError('types must not be empty')
    for (const t of types) {
      if (!VALID_TYPES.has(t)) throw new ValidationError(`Invalid search type: ${t}`)
    }

    const trimmed = query.trim()
    if (!trimmed) return emptyResult(query, { types, offset, limit })

    // vec 비활성이거나 mode=keyword & FTS도 못 쓰는 상황 → 레거시 substring 폴백
    if (!vecEnabled) {
      return legacySearch(workspaceId, query, trimmed, { types, offset, limit, highlight })
    }

    return hybridSearch(workspaceId, trimmed, query, { types, offset, limit, highlight, mode })
  }
}

// ── 하이브리드 (vec + FTS + RRF) ──────────────────────────────
async function hybridSearch(
  workspaceId: string,
  trimmed: string,
  rawQuery: string,
  opts: {
    types: SearchType[]
    offset: number
    limit: number
    highlight: boolean
    mode: 'semantic' | 'keyword' | 'hybrid'
  }
): Promise<SearchResult> {
  const { types, offset, limit, highlight, mode } = opts
  const entityTypes = new Set<EmbeddableEntityType>(types.map((t) => SEARCH_TO_ENTITY[t]))

  const lists: Ref[][] = []
  if (mode === 'keyword' || mode === 'hybrid') {
    lists.push(ftsCandidates(trimmed, entityTypes))
  }
  if (mode === 'semantic' || mode === 'hybrid') {
    lists.push(await vectorCandidates(trimmed, entityTypes))
  }

  const fused = rrfFuse(lists)

  // 타입별 메타 일괄 조회 (활성 엔티티만 → 삭제/휴지통 자동 제외)
  const idsByType = new Map<SearchType, string[]>()
  for (const ref of fused) {
    const arr = idsByType.get(ref.type) ?? []
    arr.push(ref.id)
    idsByType.set(ref.type, arr)
  }
  const folders = folderRepository.findByWorkspaceId(workspaceId)
  const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))
  const metaByType = new Map<SearchType, Map<string, EntityMeta>>()
  for (const [t, ids] of idsByType.entries()) {
    metaByType.set(t, fetchMetaByType(t, ids, folderMap))
  }

  const perTypeCounts: Record<SearchType, number> = { note: 0, table: 0, canvas: 0, todo: 0 }
  const lowerQ = trimmed.toLowerCase()
  const hits: SearchHit[] = []
  for (const ref of fused) {
    const meta = metaByType.get(ref.type)?.get(ref.id)
    if (!meta) continue // 삭제됐거나 워크스페이스 불일치 → 제외
    perTypeCounts[ref.type]++
    const matchType: SearchHit['matchType'] = meta.title.toLowerCase().includes(lowerQ)
      ? 'title'
      : ref.type === 'canvas' || ref.type === 'todo'
        ? 'description'
        : 'content'
    const folderPath = meta.folderId
      ? (folderMap.get(meta.folderId) ??
        (meta.relativePath ? extractFolderPath(meta.relativePath) : null))
      : meta.relativePath
        ? extractFolderPath(meta.relativePath)
        : null
    const hit: SearchHit = {
      type: ref.type,
      id: ref.id,
      title: meta.title,
      matchType,
      folderId: meta.folderId,
      folderPath,
      updatedAt: meta.updatedAt.toISOString(),
      preview: meta.preview
    }
    if (highlight) {
      hit.excerpt = buildExcerpt(meta.preview, trimmed) ?? buildExcerpt(meta.title, trimmed)
    }
    hits.push(hit)
  }

  const total = hits.length
  const sliced = hits.slice(offset, offset + limit)
  return {
    query: rawQuery,
    results: sliced,
    total,
    hasMore: offset + sliced.length < total,
    nextOffset: offset + sliced.length,
    meta: { types, offset, limit, perTypeCounts }
  }
}

// ── 레거시 substring 검색 (vec 비활성 폴백, 기존 동작 유지) ─────────
async function legacySearch(
  workspaceId: string,
  rawQuery: string,
  trimmed: string,
  opts: { types: SearchType[]; offset: number; limit: number; highlight: boolean }
): Promise<SearchResult> {
  const { types, offset, limit, highlight } = opts
  const folders = folderRepository.findByWorkspaceId(workspaceId)
  const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

  const hits: SearchHit[] = []
  const perTypeCounts: Record<SearchType, number> = { note: 0, table: 0, canvas: 0, todo: 0 }

  if (types.includes('note')) {
    const found = await noteService.search(workspaceId, trimmed)
    perTypeCounts.note = found.length
    for (const n of found) {
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
        hit.excerpt = buildExcerpt(n.preview, trimmed) ?? buildExcerpt(n.title, trimmed)
      }
      hits.push(hit)
    }
  }

  if (types.includes('table')) {
    const found = csvFileService.search(workspaceId, trimmed)
    perTypeCounts.table = found.length
    for (const t of found) {
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
        hit.excerpt = buildExcerpt(t.preview, trimmed) ?? buildExcerpt(t.title, trimmed)
      }
      hits.push(hit)
    }
  }

  if (types.includes('canvas')) {
    const found = canvasService.search(workspaceId, trimmed)
    perTypeCounts.canvas = found.length
    for (const c of found) {
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
        hit.excerpt = buildExcerpt(c.description, trimmed) ?? buildExcerpt(c.title, trimmed)
      }
      hits.push(hit)
    }
  }

  if (types.includes('todo')) {
    const found = todoService.search(workspaceId, trimmed)
    perTypeCounts.todo = found.length
    for (const t of found) {
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
        hit.excerpt = buildExcerpt(t.description, trimmed) ?? buildExcerpt(t.title, trimmed)
      }
      hits.push(hit)
    }
  }

  hits.sort((a, b) => {
    const aTitle = a.matchType === 'title' ? 0 : 1
    const bTitle = b.matchType === 'title' ? 0 : 1
    if (aTitle !== bTitle) return aTitle - bTitle
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  const total = hits.length
  const sliced = hits.slice(offset, offset + limit)
  return {
    query: rawQuery,
    results: sliced,
    total,
    hasMore: offset + sliced.length < total,
    nextOffset: offset + sliced.length,
    meta: { types, offset, limit, perTypeCounts }
  }
}
