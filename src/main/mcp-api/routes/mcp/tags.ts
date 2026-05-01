import type { Router } from '../../router'
import { ValidationError, NotFoundError } from '../../../lib/errors'
import { tagService } from '../../../services/tag'
import { tagRepository } from '../../../repositories/tag'
import { itemTagService } from '../../../services/item-tag'
import { itemTagRepository } from '../../../repositories/item-tag'
import { noteRepository } from '../../../repositories/note'
import { csvFileRepository } from '../../../repositories/csv-file'
import { canvasRepository } from '../../../repositories/canvas'
import { todoRepository } from '../../../repositories/todo'
import { pdfFileRepository } from '../../../repositories/pdf-file'
import { imageFileRepository } from '../../../repositories/image-file'
import { folderRepository } from '../../../repositories/folder'
import { TAGGABLE_ENTITY_TYPES, type TaggableEntityType } from '../../../db/schema/tag'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import {
  requireBody,
  resolveActiveWorkspace,
  assertOwnedByWorkspace,
  assertValidId
} from './helpers'
import type { TagAction, ManageTagResult, TagSummary, TaggedItemSummary } from './types'

const VALID_TAGGABLE_TYPES = new Set<TaggableEntityType>(TAGGABLE_ENTITY_TYPES)

interface TaggableMeta {
  workspaceId: string | null
  title: string
}

/**
 * 활성 워크스페이스에 속한 taggable item인지 검증 + 메타 반환.
 * NotFoundError: 못 찾음 / 다른 워크스페이스 → 정보 노출 방지
 */
function loadTaggableEntity(
  itemType: TaggableEntityType,
  itemId: string,
  wsId: string
): TaggableMeta {
  const lookup: Record<TaggableEntityType, () => TaggableMeta | undefined> = {
    note: () => {
      const r = noteRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.title } : undefined
    },
    csv: () => {
      const r = csvFileRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.title } : undefined
    },
    canvas: () => {
      const r = canvasRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.title } : undefined
    },
    todo: () => {
      const r = todoRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.title } : undefined
    },
    pdf: () => {
      const r = pdfFileRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.title } : undefined
    },
    image: () => {
      const r = imageFileRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.title } : undefined
    },
    folder: () => {
      const r = folderRepository.findById(itemId)
      return r ? { workspaceId: r.workspaceId, title: r.relativePath } : undefined
    }
  }
  const meta = lookup[itemType]?.()
  if (!meta || meta.workspaceId !== wsId) {
    throw new NotFoundError(`${itemType} not found in active workspace: ${itemId}`)
  }
  return meta
}

function parseItemTypesParam(query: URLSearchParams): TaggableEntityType[] | undefined {
  const csv = query.get('itemTypes')
  const repeat = query.getAll('itemTypes[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const t of cleaned) {
    if (!VALID_TAGGABLE_TYPES.has(t as TaggableEntityType)) {
      throw new ValidationError(
        `Invalid itemType: ${t}. Must be one of ${TAGGABLE_ENTITY_TYPES.join(', ')}.`
      )
    }
  }
  return cleaned as TaggableEntityType[]
}

function toTagSummary(t: ReturnType<typeof tagService.getAll>[number]): TagSummary {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    name: t.name,
    color: t.color,
    description: t.description,
    createdAt: t.createdAt.toISOString()
  }
}

export function registerMcpTagRoutes(router: Router): void {
  // ─── GET /api/mcp/tags → list_tags ────────────────────────

  router.addRoute('GET', '/api/mcp/tags', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const search = (query.get('search') ?? '').trim().toLowerCase()
    let tags = tagService.getAll(wsId)
    if (search) {
      tags = tags.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          (t.description ?? '').toLowerCase().includes(search)
      )
    }
    return { tags: tags.map(toTagSummary) }
  })

  // ─── GET /api/mcp/tags/:id/items → list_tagged_items ──────
  // itemTypes 옵션. 각 type별로 attached 항목 ID + title 반환.

  router.addRoute('GET', '/api/mcp/tags/:id/items', (params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    assertValidId(params.id, 'tag id')
    const tag = tagRepository.findById(params.id)
    assertOwnedByWorkspace(tag, wsId, `Tag not found: ${params.id}`)

    const itemTypes = parseItemTypesParam(query) ?? Array.from(TAGGABLE_ENTITY_TYPES)

    const items: TaggedItemSummary[] = []
    for (const itemType of itemTypes) {
      const ids = itemTagService.getItemIdsByTag(params.id, itemType)
      for (const itemId of ids) {
        // 같은 워크스페이스의 항목인지 + 제목 lookup. 없으면 orphan으로 간주하고 skip.
        try {
          const meta = loadTaggableEntity(itemType, itemId, wsId)
          items.push({ type: itemType, id: itemId, title: meta.title })
        } catch {
          // orphan: tag만 남고 item은 삭제됨 → 응답에서 제외
        }
      }
    }
    return { items }
  })

  // ─── GET /api/mcp/items/:itemType/:itemId/tags → list_item_tags ──

  router.addRoute('GET', '/api/mcp/tagged/:itemType/:itemId', (params): { tags: TagSummary[] } => {
    const wsId = resolveActiveWorkspace()
    const itemType = params.itemType as TaggableEntityType
    if (!VALID_TAGGABLE_TYPES.has(itemType)) {
      throw new ValidationError(
        `Invalid itemType: ${params.itemType}. Must be one of ${TAGGABLE_ENTITY_TYPES.join(', ')}.`
      )
    }
    assertValidId(params.itemId, 'itemId')
    loadTaggableEntity(itemType, params.itemId, wsId)
    const tags = itemTagService.getTagsByItem(itemType, params.itemId)
    return { tags: tags.map(toTagSummary) }
  })

  // ─── POST /api/mcp/tags/batch → manage_tags ───────────────

  router.addRoute<{ actions: TagAction[] }>(
    'POST',
    '/api/mcp/tags/batch',
    (_, body): { results: ManageTagResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const results = processBatchActions<TagAction, ManageTagResult>(
        body.actions,
        (action) => {
          if (action.action === 'create_tag') {
            const tag = tagService.create(wsId, {
              name: action.name,
              color: action.color ?? '#6b7280',
              description: action.description
            })
            return { action: 'create_tag', id: tag.id, success: true }
          }
          if (action.action === 'update_tag') {
            assertValidId(action.id, 'tag id')
            const tag = tagRepository.findById(action.id)
            assertOwnedByWorkspace(tag, wsId, `Tag not found: ${action.id}`)
            tagService.update(action.id, {
              name: action.name,
              color: action.color,
              description: action.description
            })
            return { action: 'update_tag', id: action.id, success: true }
          }
          if (action.action === 'delete_tag') {
            assertValidId(action.id, 'tag id')
            const tag = tagRepository.findById(action.id)
            assertOwnedByWorkspace(tag, wsId, `Tag not found: ${action.id}`)
            // attached items도 함께 정리 (cascade가 안 걸려 있을 수 있음)
            itemTagRepository.detachAllByTag(action.id)
            tagService.remove(action.id)
            return { action: 'delete_tag', id: action.id, success: true }
          }
          if (action.action === 'attach') {
            if (!VALID_TAGGABLE_TYPES.has(action.itemType)) {
              throw new ValidationError(`Invalid itemType: ${action.itemType}`)
            }
            assertValidId(action.tagId, 'tagId')
            assertValidId(action.itemId, 'itemId')
            const tag = tagRepository.findById(action.tagId)
            assertOwnedByWorkspace(tag, wsId, `Tag not found: ${action.tagId}`)
            loadTaggableEntity(action.itemType, action.itemId, wsId)
            itemTagService.attach(action.itemType, action.tagId, action.itemId)
            return { action: 'attach', id: action.tagId, success: true }
          }
          // detach
          if (!VALID_TAGGABLE_TYPES.has(action.itemType)) {
            throw new ValidationError(`Invalid itemType: ${action.itemType}`)
          }
          assertValidId(action.tagId, 'tagId')
          assertValidId(action.itemId, 'itemId')
          const tag = tagRepository.findById(action.tagId)
          assertOwnedByWorkspace(tag, wsId, `Tag not found: ${action.tagId}`)
          // detach는 item이 이미 사라졌어도 허용 (정리 시나리오)
          itemTagService.detach(action.itemType, action.tagId, action.itemId)
          return { action: 'detach', id: action.tagId, success: true }
        },
        { transactional: true }
      )

      broadcastChanged('tag:changed', wsId, [])
      return { results }
    }
  )
}
