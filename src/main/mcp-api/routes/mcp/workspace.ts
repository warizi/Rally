import type { Router } from '../../router'
import { ValidationError } from '../../../lib/errors'
import { workspaceInfoService, type StatsKind } from '../../../services/workspace-info'
import { resolveActiveWorkspace } from './helpers'

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
}
