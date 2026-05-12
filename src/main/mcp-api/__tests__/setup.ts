/**
 * mcp-api 테스트 공용 헬퍼.
 *
 * 보안-2 Phase 2 — IncomingMessage / ServerResponse 모킹.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { vi } from 'vitest'

export interface MakeReqOptions {
  method?: string
  url?: string
  headers?: Record<string, string | string[]>
  body?: unknown
}

export function makeReq(opts: MakeReqOptions = {}): IncomingMessage {
  const readable = new Readable({
    read() {
      // no-op — push 로 데이터 주입함
    }
  })
  if (opts.body !== undefined) {
    readable.push(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))
  }
  readable.push(null)
  const req = readable as unknown as IncomingMessage
  req.method = opts.method ?? 'GET'
  req.url = opts.url ?? '/'
  req.headers = opts.headers ?? {}
  return req
}

export interface CapturedResponse {
  res: ServerResponse
  getStatusCode(): number
  getBody(): string
  getJson<T = unknown>(): T
  getHeaders(): Record<string, string>
}

/**
 * ServerResponse 의 writeHead/end 를 가로채 status/body/headers 캡처.
 */
export function makeRes(): CapturedResponse {
  let statusCode = 200
  let body = ''
  const headers: Record<string, string> = {}

  const res = {
    writeHead: vi.fn((code: number, h?: Record<string, string>) => {
      statusCode = code
      if (h) Object.assign(headers, h)
      return res
    }),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value
    }),
    end: vi.fn((chunk?: unknown) => {
      if (chunk !== undefined) body = String(chunk)
    }),
    write: vi.fn((chunk: unknown) => {
      body += String(chunk)
    })
  } as unknown as ServerResponse

  return {
    res,
    getStatusCode: () => statusCode,
    getBody: () => body,
    getJson: <T = unknown>(): T => JSON.parse(body) as T,
    getHeaders: () => headers
  }
}
