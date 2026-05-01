import type { Router } from '../../router'
import { ValidationError } from '../../../lib/errors'
import { trashService, type TrashEntityKind, type TrashListOptions } from '../../../services/trash'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

const VALID_KINDS: ReadonlySet<TrashEntityKind> = new Set([
  'folder',
  'note',
  'csv',
  'pdf',
  'image',
  'canvas',
  'todo',
  'schedule',
  'recurring_rule',
  'template'
])

function parseTypesParam(query: URLSearchParams): TrashEntityKind[] | undefined {
  const csv = query.get('types')
  const repeat = query.getAll('types[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const t of cleaned) {
    if (!VALID_KINDS.has(t as TrashEntityKind)) {
      throw new ValidationError(`Invalid trash type: ${t}`)
    }
  }
  return cleaned as TrashEntityKind[]
}

function parseNonNegInt(raw: string | null, label: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || `${n}` !== raw) {
    throw new ValidationError(`${label} must be a non-negative integer`)
  }
  return n
}

export function registerMcpTrashRoutes(router: Router): void {
  // ─── GET /api/mcp/trash → list_trash ──────────────────────

  router.addRoute('GET', '/api/mcp/trash', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const types = parseTypesParam(query)
    const search = query.get('search') ?? undefined
    const offset = parseNonNegInt(query.get('offset'), 'offset')
    const limit = parseNonNegInt(query.get('limit'), 'limit')

    const options: TrashListOptions = { types, search, offset, limit }
    const result = trashService.list(wsId, options)
    return {
      batches: result.batches.map((b) => ({
        ...b,
        deletedAt: b.deletedAt.toISOString()
      })),
      meta: {
        total: result.total,
        hasMore: result.hasMore,
        nextOffset: result.nextOffset
      }
    }
  })

  // ─── POST /api/mcp/trash/:batchId/restore → restore_trash ──

  router.addRoute<null>('POST', '/api/mcp/trash/:batchId/restore', (params) => {
    resolveActiveWorkspace()
    assertValidId(params.batchId, 'batchId')
    const result = trashService.restore(params.batchId)
    return {
      restored: result.restored,
      conflicts: result.conflicts ?? []
    }
  })

  // ─── POST /api/mcp/trash/:batchId/purge → permanent delete single batch ──

  router.addRoute<null>('POST', '/api/mcp/trash/:batchId/purge', (params) => {
    resolveActiveWorkspace()
    assertValidId(params.batchId, 'batchId')
    trashService.purge(params.batchId)
    return { success: true, batchId: params.batchId }
  })

  // ─── POST /api/mcp/trash/empty → empty_trash (전체 또는 단일) ──

  router.addRoute<{ batchId?: string; confirm?: boolean }>(
    'POST',
    '/api/mcp/trash/empty',
    (_, body) => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      // 전체 비우기는 확인 토큰 필수 (AI/사용자 사고 방지)
      if (!body.batchId && body.confirm !== true) {
        throw new ValidationError(
          'empty_trash without batchId requires confirm: true (this permanently deletes ALL trash items)'
        )
      }

      if (body.batchId) {
        assertValidId(body.batchId, 'batchId')
        trashService.purge(body.batchId)
        return { purgedBatchIds: [body.batchId] }
      }

      // 전체 비우기 — 모든 batch 조회 후 각각 purge
      const all = trashService.list(wsId, { limit: 200 })
      // 200개씩 페이지네이션 (안전장치). 한 번의 호출로 모두 비우려면 여러 번.
      const purgedBatchIds: string[] = []
      for (const batch of all.batches) {
        trashService.purge(batch.id)
        purgedBatchIds.push(batch.id)
      }
      return { purgedBatchIds, hasMore: all.hasMore }
    }
  )
}
