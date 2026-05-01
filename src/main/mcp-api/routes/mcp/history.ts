import type { Router } from '../../router'
import { ValidationError } from '../../../lib/errors'
import { historyService } from '../../../services/history'
import { resolveActiveWorkspace } from './helpers'

function parseNonNegInt(raw: string | null, label: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || `${n}` !== raw) {
    throw new ValidationError(`${label} must be a non-negative integer`)
  }
  return n
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateKey(raw: string | null, label: string): string | undefined {
  if (raw === null || raw === '') return undefined
  if (!DATE_RE.test(raw)) {
    throw new ValidationError(`${label} must be YYYY-MM-DD`)
  }
  return raw
}

export function registerMcpHistoryRoutes(router: Router): void {
  // ─── GET /api/mcp/history → get_history ───────────────────
  // historyService.fetch에 그대로 위임 — 결과 직렬화는 service가 이미 ISO/string 반환.

  router.addRoute('GET', '/api/mcp/history', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const dayOffset = parseNonNegInt(query.get('dayOffset'), 'dayOffset')
    const dayLimit = parseNonNegInt(query.get('dayLimit'), 'dayLimit')
    const fromDate = parseDateKey(query.get('fromDate'), 'fromDate')
    const toDate = parseDateKey(query.get('toDate'), 'toDate')
    const queryStr = query.get('query') ?? undefined

    const result = historyService.fetch(wsId, {
      dayOffset,
      dayLimit,
      fromDate,
      toDate,
      query: queryStr
    })

    return {
      days: result.days.map((d) => ({
        date: d.date,
        todos: d.todos.map((t) => ({
          id: t.id,
          title: t.title,
          doneAt: t.doneAt.toISOString(),
          kind: t.kind,
          links: t.links
        }))
      })),
      hasMore: result.hasMore,
      nextDayOffset: result.nextDayOffset
    }
  })
}
