import http from 'http'
import { parseBody } from './lib/body-parser'
import { normalizeError } from '../lib/errors'
import { workspaceWatcher } from '../services/workspace-watcher'
import { workspaceRepository } from '../repositories/workspace'

type RouteParams = Record<string, string>
type RouteHandler = (
  params: RouteParams,
  body: unknown,
  query: URLSearchParams
) => unknown | Promise<unknown>

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

// 에러 정규화는 lib/errors.ts의 normalizeError 사용

interface RouterInstance {
  addRoute: <TBody = null>(
    method: string,
    pathPattern: string,
    handler: (
      params: RouteParams,
      body: TBody extends null ? null : TBody,
      query: URLSearchParams
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
      query: URLSearchParams
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
        const result = await Promise.resolve(route.handler(params, body, query))

        const wsId = workspaceWatcher.getActiveWorkspaceId()
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
