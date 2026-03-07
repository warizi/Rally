import http from 'http'
import { parseBody } from './lib/body-parser'
import { NotFoundError, ValidationError, ConflictError, PayloadTooLargeError } from '../lib/errors'

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

function mapErrorToStatus(error: Error): number {
  if (error instanceof PayloadTooLargeError) return 413
  if (error instanceof NotFoundError) return 404
  if (error instanceof ValidationError) return 400
  if (error instanceof ConflictError) return 409
  return 500
}

function mapErrorToType(error: Error): string {
  if (error instanceof PayloadTooLargeError) return 'PayloadTooLargeError'
  if (error instanceof NotFoundError) return 'NotFoundError'
  if (error instanceof ValidationError) return 'ValidationError'
  if (error instanceof ConflictError) return 'ConflictError'
  return 'UnknownError'
}

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

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (error) {
        if (error instanceof Error) {
          const status = mapErrorToStatus(error)
          const details = (error as unknown as Record<string, unknown>).details
          res.writeHead(status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            error: error.message,
            errorType: mapErrorToType(error),
            ...(details ? { details } : {})
          }))
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(error), errorType: 'UnknownError' }))
        }
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found', errorType: 'NotFoundError' }))
  }

  return { addRoute, handle }
}

export type Router = ReturnType<typeof createRouter>
