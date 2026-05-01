import type { Router } from '../../router'
import type { ManageItemResult, ItemAction } from './types'
import { ValidationError } from '../../../lib/errors'
import { noteService } from '../../../services/note'
import { csvFileService } from '../../../services/csv-file'
import {
  workspaceItemsService,
  type ListWorkspaceItemsOptions,
  type WorkspaceItemKind
} from '../../../services/workspace-items'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, resolveItemType, assertValidId } from './helpers'

const VALID_KINDS: ReadonlySet<WorkspaceItemKind> = new Set(['folder', 'note', 'table', 'canvas'])

function parseIntParam(raw: string | null, label: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || `${n}` !== raw) {
    throw new ValidationError(`${label} must be a non-negative integer`)
  }
  return n
}

function parseTypesParam(query: URLSearchParams): WorkspaceItemKind[] | undefined {
  // 두 가지 입력 허용: ?types=note,canvas (CSV) 또는 ?types[]=note&types[]=canvas
  const csv = query.get('types')
  const repeat = query.getAll('types[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const t of cleaned) {
    if (!VALID_KINDS.has(t as WorkspaceItemKind)) {
      throw new ValidationError(`Invalid type: ${t}. Must be one of folder, note, table, canvas.`)
    }
  }
  return cleaned as WorkspaceItemKind[]
}

export function registerMcpItemRoutes(router: Router): void {
  // ─── GET /api/mcp/items → list_items ───────────────────────

  router.addRoute('GET', '/api/mcp/items', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()

    const folderId = query.get('folderId') || undefined
    if (folderId) assertValidId(folderId, 'folderId')

    const recursive = query.get('recursive') === 'true'
    const summary = query.get('summary') === 'true'
    const types = parseTypesParam(query)

    const updatedAfterRaw = query.get('updatedAfter')
    let updatedAfter: Date | undefined
    if (updatedAfterRaw) {
      const d = new Date(updatedAfterRaw)
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError('updatedAfter must be a valid ISO 8601 date')
      }
      updatedAfter = d
    }

    const limit = parseIntParam(query.get('limit'), 'limit')
    const offset = parseIntParam(query.get('offset'), 'offset')

    const options: ListWorkspaceItemsOptions = {
      folderId,
      recursive,
      types,
      summary,
      updatedAfter,
      limit,
      offset
    }
    return workspaceItemsService.list(wsId, options)
  })

  // ─── POST /api/mcp/items/batch → manage_items ─────────────

  router.addRoute<{ actions: ItemAction[] }>(
    'POST',
    '/api/mcp/items/batch',
    (_, body): { results: ManageItemResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const noteAffected: string[] = []
      const tableAffected: string[] = []

      // FS + DB 혼합 작업이라 transactional: false (DB만 트랜잭션 묶어도 FS와 어긋남).
      // 향후 service 레벨에서 atomic 보장을 추가하는 별도 작업 필요.
      const results = processBatchActions<ItemAction, ManageItemResult>(
        body.actions,
        (action) => {
          assertValidId(action.id, 'item id')
          if (action.action === 'move' && action.targetFolderId) {
            assertValidId(action.targetFolderId, 'targetFolderId')
          }
          const resolved = resolveItemType(action.id)

          if (action.action === 'rename') {
            if (resolved.type === 'note') {
              const old = resolved.row.relativePath
              const result = noteService.rename(wsId, action.id, action.newName)
              noteAffected.push(old, result.relativePath)
            } else {
              const old = resolved.row.relativePath
              const result = csvFileService.rename(wsId, action.id, action.newName)
              tableAffected.push(old, result.relativePath)
            }
          } else if (action.action === 'move') {
            if (resolved.type === 'note') {
              const old = resolved.row.relativePath
              const result = noteService.move(wsId, action.id, action.targetFolderId ?? null, 0)
              noteAffected.push(old, result.relativePath)
            } else {
              const old = resolved.row.relativePath
              const result = csvFileService.move(wsId, action.id, action.targetFolderId ?? null, 0)
              tableAffected.push(old, result.relativePath)
            }
          } else {
            // delete
            if (resolved.type === 'note') {
              noteAffected.push(resolved.row.relativePath)
              noteService.remove(wsId, action.id)
            } else {
              tableAffected.push(resolved.row.relativePath)
              csvFileService.remove(wsId, action.id)
            }
          }
          return { action: action.action, type: resolved.type, id: action.id, success: true }
        },
        { transactional: false }
      )

      if (noteAffected.length > 0) broadcastChanged('note:changed', wsId, noteAffected)
      if (tableAffected.length > 0) broadcastChanged('csv:changed', wsId, tableAffected)

      return { results }
    }
  )
}
