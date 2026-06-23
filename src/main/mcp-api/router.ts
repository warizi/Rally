import http from 'http'
import { parseBody } from './lib/body-parser'
import { isAuthenticated, writeUnauthorized } from './lib/auth'
import { normalizeError } from '../lib/errors'
import { workspaceWatcher } from '../services/workspace-watcher'
import { workspaceRepository } from '../repositories/workspace'
import type { Actor } from '../services/_shared/actor'
import {
  createActivityCollector,
  emitMcpActivity,
  type McpActivityRecord
} from './lib/activity'

type RouteParams = Record<string, string>

export interface RequestContext {
  actor: Actor
  clientName: string | null
  clientVersion: string | null
  /**
   * MCP 활동 보고 — 라우트가 수행한 mutation 을 알린다.
   * router.handle() 이 요청 성공 후 모인 record 를 mcp:activity 로 한 번에 발행한다.
   * (읽기 라우트는 호출하지 않으면 된다.)
   */
  recordActivity: (record: McpActivityRecord) => void
}

type RouteHandler = (
  params: RouteParams,
  body: unknown,
  query: URLSearchParams,
  context: RequestContext
) => unknown | Promise<unknown>

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

function readHeader(req: http.IncomingMessage, name: string): string | null {
  const raw = req.headers[name]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildContext(
  req: http.IncomingMessage,
  recordActivity: (record: McpActivityRecord) => void
): RequestContext {
  const clientName = readHeader(req, 'x-mcp-client-name')
  const clientVersion = readHeader(req, 'x-mcp-client-version')
  return {
    actor: { kind: 'ai', id: clientName },
    clientName,
    clientVersion,
    recordActivity
  }
}

// 에러 정규화는 lib/errors.ts의 normalizeError 사용

interface RouterInstance {
  addRoute: <TBody = null>(
    method: string,
    pathPattern: string,
    handler: (
      params: RouteParams,
      body: TBody extends null ? null : TBody,
      query: URLSearchParams,
      context: RequestContext
    ) => unknown | Promise<unknown>
  ) => void
  handle: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
}

export function createRouter(): RouterInstance {
  const routes: Route[] = []

  function addRoute<TBody = null>(
    method: string,
    pathPattern: string,
    handler: (
      params: RouteParams,
      body: TBody extends null ? null : TBody,
      query: URLSearchParams,
      context: RequestContext
    ) => unknown | Promise<unknown>
  ): void {
    const paramNames: string[] = []
    const regexStr = pathPattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    routes.push({
      method,
      pattern: new RegExp(`^${regexStr}$`),
      paramNames,
      handler: handler as Route['handler']
    })
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // 보안-2 Phase 2: 모든 요청은 x-mcp-token 헤더 검증 통과 후 라우팅.
    // ensureMcpToken() 으로 발급/캐시된 토큰과 timing-safe 비교.
    if (!isAuthenticated(req)) {
      writeUnauthorized(res)
      return
    }

    const urlObj = new URL(req.url || '/', 'http://localhost')
    const pathname = urlObj.pathname
    const query = urlObj.searchParams
    const method = req.method || 'GET'

    for (const route of routes) {
      if (route.method !== method) continue
      const match = pathname.match(route.pattern)
      if (!match) continue

      const params: RouteParams = {}
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = decodeURIComponent(match[i + 1])
      }

      try {
        const body = method === 'GET' ? null : await parseBody(req)
        const collector = createActivityCollector()
        const context = buildContext(req, collector.record)
        const result = await Promise.resolve(route.handler(params, body, query, context))

        const wsId = workspaceWatcher.getActiveWorkspaceId()
        // 요청이 성공했을 때만 활동을 발행한다 (실패 시 catch 로 빠져 미발행).
        emitMcpActivity(wsId, context.actor, collector.drain())
        const wsName = wsId ? (workspaceRepository.findById(wsId)?.name ?? null) : null
        const response = { _workspace: { id: wsId, name: wsName }, ...(result as object) }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
      } catch (error) {
        const normalized = normalizeError(error)
        res.writeHead(normalized.status, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            // 새 stable contract: code (ErrorCode enum)
            code: normalized.code,
            error: normalized.message,
            // 호환성: 기존 응답 필드 유지
            errorType: normalized.name,
            ...(normalized.details ? { details: normalized.details } : {})
          })
        )
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 'NOT_FOUND', error: 'Not Found', errorType: 'NotFoundError' }))
  }

  return { addRoute, handle }
}

export type Router = ReturnType<typeof createRouter>
