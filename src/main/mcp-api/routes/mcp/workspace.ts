import type { Router } from '../../router'
import { ValidationError, NotFoundError } from '../../../lib/errors'
import { workspaceInfoService, type StatsKind } from '../../../services/workspace-info'
import { workspaceRepository } from '../../../repositories/workspace'
import { workspaceWatcher } from '../../../services/workspace-watcher'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

const VALID_STATS_KINDS: ReadonlySet<StatsKind> = new Set([
  'folders',
  'notes',
  'tables',
  'canvases',
  'todos',
  'pdfs',
  'images',
  'schedules',
  'tags',
  'templates',
  'recurringRules'
])

function parseStatsKindsParam(query: URLSearchParams): StatsKind[] | undefined {
  const csv = query.get('types')
  const repeat = query.getAll('types[]')
  const raw = repeat.length > 0 ? repeat : csv ? csv.split(',') : []
  if (raw.length === 0) return undefined
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0)
  if (cleaned.length === 0) return undefined
  for (const t of cleaned) {
    if (!VALID_STATS_KINDS.has(t as StatsKind)) {
      throw new ValidationError(
        `Invalid stats type: ${t}. Must be one of ${Array.from(VALID_STATS_KINDS).join(', ')}.`
      )
    }
  }
  return cleaned as StatsKind[]
}

export function registerMcpWorkspaceRoutes(router: Router): void {
  // ─── GET /api/mcp/workspace → get_workspace_info ──────────

  router.addRoute('GET', '/api/mcp/workspace', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const recentRaw = query.get('recentLimit')
    let recentLimit = 10
    if (recentRaw !== null && recentRaw !== '') {
      const n = Number.parseInt(recentRaw, 10)
      if (!Number.isFinite(n) || n < 0 || n > 50 || `${n}` !== recentRaw) {
        throw new ValidationError('recentLimit must be an integer between 0 and 50')
      }
      recentLimit = n
    }
    return workspaceInfoService.getInfo(wsId, recentLimit)
  })

  // ─── GET /api/mcp/workspace/stats → get_stats ─────────────

  router.addRoute('GET', '/api/mcp/workspace/stats', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const types = parseStatsKindsParam(query)
    const stats = workspaceInfoService.getStats(wsId, types)
    return { stats }
  })

  // ─── GET /api/mcp/workspaces → manage_workspace(action:'list') ────────
  // 활성 워크스페이스가 없어도 동작 (목록만 반환). 각 항목에 active flag 포함.

  router.addRoute('GET', '/api/mcp/workspaces', () => {
    const activeId = workspaceWatcher.getActiveWorkspaceId()
    const all = workspaceRepository.findAll()
    return {
      workspaces: all.map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        active: w.id === activeId
      }))
    }
  })

  // ─── POST /api/mcp/workspace/switch → manage_workspace(action:'switch') ──
  // 같은 워크스페이스로 재전환 시 no-op (alreadyActive:true). renderer UI 는
  // 'workspace:active-changed' 브로드캐스트로 동기화.

  router.addRoute<{ workspaceId: string }>(
    'POST',
    '/api/mcp/workspace/switch',
    async (_params, body) => {
      requireBody(body)
      if (typeof body.workspaceId !== 'string') {
        throw new ValidationError('workspaceId is required')
      }
      assertValidId(body.workspaceId, 'workspaceId')

      const ws = workspaceRepository.findById(body.workspaceId)
      if (!ws) throw new NotFoundError(`Workspace not found: ${body.workspaceId}`)

      const currentActiveId = workspaceWatcher.getActiveWorkspaceId()
      const alreadyActive = currentActiveId === ws.id

      if (!alreadyActive) {
        await workspaceWatcher.ensureWatching(ws.id, ws.path)
        broadcastChanged('workspace:active-changed', ws.id, [])
      }

      return {
        workspace: {
          id: ws.id,
          name: ws.name,
          path: ws.path,
          active: true
        },
        alreadyActive
      }
    }
  )
}
