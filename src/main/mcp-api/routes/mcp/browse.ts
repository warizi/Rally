/**
 * MCP v2 browse 라우트.
 *
 * list_items + list_files (pdf/image) + list_tagged_items + list_tags (workspace mode) 통합.
 * type discriminator 와 cross-cutting 필터(tagId, linkedTo) 로 단일 도구가 7종 entity 를 다룬다.
 *
 * 외부 API (browse tool) 의 type 명명:
 *   folder, note, csv, canvas, pdf, image, tag
 *
 * 내부 service 의 type 명명 차이:
 *   - workspaceItemsService: 'table' (= csv 대응)
 *   - 그 외 (item-tag, entity-link 등): 모두 'csv' 사용
 *
 * 응답 키 — workspaceItemsService 와 일관: folders / notes / tables / canvases / pdfs / images / tags
 */
import type { Router } from '../../router'
import { NotFoundError, ValidationError } from '../../../lib/errors'
import { workspaceRepository } from '../../../repositories/workspace'
import {
  workspaceItemsService,
  type ListWorkspaceItemsOptions,
  type WorkspaceItemKind
} from '../../../services/workspace-items'
import { pdfFileService } from '../../../services/pdf-file'
import { imageFileService } from '../../../services/image-file'
import { tagService } from '../../../services/tag'
import { itemTagService } from '../../../services/item-tag'
import { entityLinkService } from '../../../services/entity-link'
import { folderRepository } from '../../../repositories/folder'
import { resolveActiveWorkspace, assertValidId } from './helpers'
import type {
  LinkableEntityType,
  // re-export 회피용 type alias
} from '../../../db/schema/entity-link'
import type { TaggableEntityType } from '../../../db/schema/tag'

// 외부 type 명명 (browse tool 의 types[])
type BrowseType = 'folder' | 'note' | 'csv' | 'canvas' | 'pdf' | 'image' | 'tag'

const ALL_BROWSE_TYPES: readonly BrowseType[] = [
  'folder',
  'note',
  'csv',
  'canvas',
  'pdf',
  'image',
  'tag'
]
const VALID_BROWSE_TYPES = new Set<BrowseType>(ALL_BROWSE_TYPES)

const VALID_LINKED_TYPES = new Set<LinkableEntityType>([
  'todo',
  'schedule',
  'note',
  'pdf',
  'csv',
  'image',
  'canvas'
])

const LINKABLE_BROWSE_TYPES = new Set<BrowseType>([
  'note',
  'csv',
  'canvas',
  'pdf',
  'image'
])

function parseIntParam(raw: string | null, label: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || `${n}` !== raw) {
    throw new ValidationError(`${label} must be a non-negative integer`)
  }
  return n
}

function parseTypesParam(query: URLSearchParams): BrowseType[] | undefined {
  // 두 가지 입력 허용: ?types=note,canvas 또는 ?types[]=note&types[]=canvas
  const csv = query.get('types')
  const repeat = query.getAll('types[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const t of cleaned) {
    if (!VALID_BROWSE_TYPES.has(t as BrowseType)) {
      throw new ValidationError(
        `Invalid type: ${t}. Must be one of ${ALL_BROWSE_TYPES.join(', ')}.`
      )
    }
  }
  return cleaned as BrowseType[]
}

function parseLinkedTo(query: URLSearchParams): { type: LinkableEntityType; id: string } | null {
  const t = query.get('linkedTo[type]')
  const i = query.get('linkedTo[id]')
  if (t === null && i === null) return null
  if (t === null || i === null) {
    throw new ValidationError('linkedTo requires both type and id')
  }
  if (!VALID_LINKED_TYPES.has(t as LinkableEntityType)) {
    throw new ValidationError(`Invalid linkedTo type: ${t}`)
  }
  assertValidId(i, 'linkedTo.id')
  return { type: t as LinkableEntityType, id: i }
}

function browseToTaggable(t: BrowseType): TaggableEntityType | null {
  if (t === 'tag') return null
  return t as TaggableEntityType
}

/**
 * tagId / linkedTo 가 지정된 경우 type 별 허용 ID set 을 만든다.
 * 둘 다 지정되면 두 set 의 교집합 (AND) 을 반환.
 * 둘 다 미지정이면 null (제약 없음).
 *
 * 반환된 map 에서 type 키가 없으면 = 그 type 은 비어있음 (필터에 의해 전부 제거).
 */
function buildRestrictMap(
  wsId: string,
  tagId: string | undefined,
  linkedTo: { type: LinkableEntityType; id: string } | null,
  requestedTypes: BrowseType[]
): Map<BrowseType, Set<string>> | null {
  if (!tagId && !linkedTo) return null

  const result = new Map<BrowseType, Set<string>>()

  let tagSet: Map<BrowseType, Set<string>> | null = null
  if (tagId) {
    tagSet = new Map()
    for (const t of requestedTypes) {
      const taggable = browseToTaggable(t)
      if (!taggable) continue
      const ids = itemTagService.getItemIdsByTag(tagId, taggable)
      tagSet.set(t, new Set(ids))
    }
  }

  let linkSet: Map<BrowseType, Set<string>> | null = null
  if (linkedTo) {
    linkSet = new Map()
    const linked = entityLinkService.getLinked(linkedTo.type, linkedTo.id, wsId)
    for (const le of linked) {
      // entityLinkService 의 entityType → BrowseType 매핑
      // entityType 후보: note/csv/canvas/todo/pdf/image/schedule
      // browse 에서 노출되는 것: note/csv/canvas/pdf/image (todo/schedule 은 read_tasks)
      const t = le.entityType as BrowseType
      if (!LINKABLE_BROWSE_TYPES.has(t)) continue
      if (!linkSet.has(t)) linkSet.set(t, new Set())
      linkSet.get(t)!.add(le.entityId)
    }
  }

  for (const t of requestedTypes) {
    // tag 는 tagId/linkedTo 어디에도 해당 안됨 → restrict 없이 통과
    if (t === 'tag') continue

    const fromTag = tagSet?.get(t)
    const fromLink = linkSet?.get(t)

    if (tagSet && !fromTag) {
      // tag 필터인데 이 type 에는 해당 없음 → 빈 set
      result.set(t, new Set())
      continue
    }
    if (linkSet && !fromLink) {
      // link 필터인데 이 type 에 해당 없음 → 빈 set (folder 포함: linkable 아님)
      result.set(t, new Set())
      continue
    }
    if (fromTag && fromLink) {
      // 교집합
      const intersect = new Set<string>()
      for (const id of fromTag) if (fromLink.has(id)) intersect.add(id)
      result.set(t, intersect)
    } else if (fromTag) {
      result.set(t, fromTag)
    } else if (fromLink) {
      result.set(t, fromLink)
    }
  }

  return result
}

function applyIdRestrict<T extends { id: string }>(
  rows: T[],
  restrict: Set<string> | undefined
): T[] {
  if (!restrict) return rows
  return rows.filter((r) => restrict.has(r.id))
}

function applySearchTitle<T extends { title: string; description?: string | null }>(
  rows: T[],
  search: string
): T[] {
  if (!search) return rows
  const lower = search.toLowerCase()
  return rows.filter(
    (r) =>
      r.title.toLowerCase().includes(lower) ||
      (r.description ?? '').toLowerCase().includes(lower)
  )
}

interface FileBrowseRow {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}

interface FolderScopeResult {
  folderId: string | null | undefined
  folderIds: Set<string> | null
}

function resolveFolderScopeForFiles(
  wsId: string,
  raw: string | null,
  recursive: boolean
): FolderScopeResult {
  if (raw === null || raw === '') return { folderId: undefined, folderIds: null }
  if (raw === 'null') return { folderId: null, folderIds: null }
  assertValidId(raw, 'folderId')
  const allFolders = folderRepository.findByWorkspaceId(wsId)
  const target = allFolders.find((f) => f.id === raw)
  if (!target) throw new ValidationError(`Folder not found: ${raw}`)
  if (!recursive) return { folderId: undefined, folderIds: new Set([target.id]) }
  const set = new Set<string>([target.id])
  for (const f of allFolders) {
    if (f.relativePath.startsWith(`${target.relativePath}/`)) set.add(f.id)
  }
  return { folderId: undefined, folderIds: set }
}

function filterFiles(
  rows: FileBrowseRow[],
  scope: FolderScopeResult,
  search: string,
  restrict: Set<string> | undefined,
  updatedAfter: Date | undefined,
  limit: number,
  offset: number
): { items: ReturnType<typeof toFileSummary>[]; total: number; hasMore: boolean } {
  let filtered = rows
  if (scope.folderId === null) filtered = filtered.filter((r) => r.folderId === null)
  else if (scope.folderIds)
    filtered = filtered.filter((r) => r.folderId !== null && scope.folderIds!.has(r.folderId))
  if (restrict) filtered = filtered.filter((r) => restrict.has(r.id))
  if (updatedAfter)
    filtered = filtered.filter((r) => {
      const u = r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)
      return u.getTime() >= updatedAfter.getTime()
    })
  if (search) {
    const lower = search.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        (r.description ?? '').toLowerCase().includes(lower)
    )
  }
  const total = filtered.length
  const paged = filtered.slice(offset, offset + limit)
  return {
    items: paged.map(toFileSummary),
    total,
    hasMore: offset + limit < total
  }
}

function toFileSummary(row: FileBrowseRow): {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: string
  updatedAt: string
} {
  const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
  const updated = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)
  return {
    id: row.id,
    title: row.title,
    relativePath: row.relativePath,
    description: row.description,
    preview: row.preview,
    folderId: row.folderId,
    order: row.order,
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString()
  }
}

export function registerMcpBrowseRoutes(router: Router): void {
  router.addRoute('GET', '/api/mcp/browse', (_p, _b, query) => {
    const wsId = resolveActiveWorkspace()
    const ws = workspaceRepository.findById(wsId)
    if (!ws) throw new NotFoundError(`Workspace not found: ${wsId}`)

    // 파라미터 파싱
    const folderIdRaw = query.get('folderId')
    const recursive = query.get('recursive') === 'true'
    const summary = query.get('summary') === 'true'
    const types = parseTypesParam(query) ?? Array.from(ALL_BROWSE_TYPES)

    const tagId = query.get('tagId') || undefined
    if (tagId) assertValidId(tagId, 'tagId')

    const linkedTo = parseLinkedTo(query)
    const search = (query.get('search') ?? '').trim()

    const updatedAfterRaw = query.get('updatedAfter')
    let updatedAfter: Date | undefined
    if (updatedAfterRaw) {
      const d = new Date(updatedAfterRaw)
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError('updatedAfter must be a valid ISO 8601 date')
      }
      updatedAfter = d
    }

    const limit = parseIntParam(query.get('limit'), 'limit') ?? 500
    const offset = parseIntParam(query.get('offset'), 'offset') ?? 0
    if (limit < 1 || limit > 1000) {
      throw new ValidationError('limit must be between 1 and 1000')
    }

    // tagId + linkedTo 로 type 별 허용 ID 셋 빌드
    const restrictMap = buildRestrictMap(wsId, tagId, linkedTo, types)

    // workspaceItemsService 가 다루는 종류 (folder/note/csv/canvas)
    const itemsKinds: WorkspaceItemKind[] = []
    if (types.includes('folder')) itemsKinds.push('folder')
    if (types.includes('note')) itemsKinds.push('note')
    if (types.includes('csv')) itemsKinds.push('table')
    if (types.includes('canvas')) itemsKinds.push('canvas')

    const response: Record<string, unknown> = {
      workspace: { id: ws.id, name: ws.name, path: ws.path }
    }
    const counts: Record<string, number> = {}
    const hasMore: Record<string, boolean> = {}

    if (itemsKinds.length > 0) {
      const folderIdForList = folderIdRaw === 'null' ? null : folderIdRaw || undefined
      const options: ListWorkspaceItemsOptions = {
        folderId: folderIdForList ?? null,
        recursive,
        types: itemsKinds,
        summary,
        updatedAfter,
        limit,
        offset
      }
      const r = workspaceItemsService.list(wsId, options)
      if (types.includes('folder')) {
        const all = r.folders
        // folder 는 restrict 적용 (tagId 만 가능, linkedTo 는 folder 미지원)
        const restricted = applyIdRestrict(all, restrictMap?.get('folder'))
        // folder 는 search 필드 없음 — relativePath 매칭으로 대체
        const searched = search
          ? restricted.filter((f) => f.relativePath.toLowerCase().includes(search.toLowerCase()))
          : restricted
        response.folders = searched
        counts.folders = searched.length
        hasMore.folders = r.meta.hasMore.folders
      }
      if (types.includes('note')) {
        const restricted = applyIdRestrict(r.notes, restrictMap?.get('note'))
        const searched = search ? applySearchTitle(restricted, search) : restricted
        response.notes = searched
        counts.notes = searched.length
        hasMore.notes = r.meta.hasMore.notes
      }
      if (types.includes('csv')) {
        const restricted = applyIdRestrict(r.tables, restrictMap?.get('csv'))
        const searched = search ? applySearchTitle(restricted, search) : restricted
        response.tables = searched
        counts.tables = searched.length
        hasMore.tables = r.meta.hasMore.tables
      }
      if (types.includes('canvas')) {
        const restricted = applyIdRestrict(r.canvases, restrictMap?.get('canvas'))
        const searched = search ? applySearchTitle(restricted, search) : restricted
        response.canvases = searched
        counts.canvases = searched.length
        hasMore.canvases = r.meta.hasMore.canvases
      }
    }

    // pdf / image — 자체 파이프라인 (별도 service)
    const fileScope = resolveFolderScopeForFiles(wsId, folderIdRaw, recursive)

    if (types.includes('pdf')) {
      const rows = pdfFileService.readByWorkspaceFromDb(wsId)
      const filtered = filterFiles(
        rows,
        fileScope,
        search,
        restrictMap?.get('pdf'),
        updatedAfter,
        limit,
        offset
      )
      response.pdfs = filtered.items
      counts.pdfs = filtered.items.length
      hasMore.pdfs = filtered.hasMore
    }
    if (types.includes('image')) {
      const rows = imageFileService.readByWorkspaceFromDb(wsId)
      const filtered = filterFiles(
        rows,
        fileScope,
        search,
        restrictMap?.get('image'),
        updatedAfter,
        limit,
        offset
      )
      response.images = filtered.items
      counts.images = filtered.items.length
      hasMore.images = filtered.hasMore
    }

    // tag — restrictBy 미적용 (tag 는 tag 못 가짐). search 만 + updatedAfter 미적용 (tag 는 updatedAt 추적 X).
    if (types.includes('tag')) {
      const all = tagService.getAll(wsId)
      let tags = all
      if (search) {
        const lower = search.toLowerCase()
        tags = tags.filter(
          (t) =>
            t.name.toLowerCase().includes(lower) ||
            (t.description ?? '').toLowerCase().includes(lower)
        )
      }
      const total = tags.length
      const paged = tags.slice(offset, offset + limit)
      response.tags = paged.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        description: t.description,
        createdAt: t.createdAt.toISOString()
      }))
      counts.tags = paged.length
      hasMore.tags = offset + limit < total
    }

    response.meta = {
      summary,
      folderId: folderIdRaw === 'null' ? null : (folderIdRaw ?? null),
      recursive,
      types,
      tagId: tagId ?? null,
      linkedTo: linkedTo ?? null,
      limit,
      offset,
      counts,
      hasMore
    }

    return response
  })
}
