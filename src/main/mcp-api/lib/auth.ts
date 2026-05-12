/**
 * MCP API 인증 미들웨어.
 *
 * 보안-2 Phase 2 — 모든 라우터 요청 전에 `x-mcp-token` 헤더를 검증.
 * timing attack 회피를 위해 `crypto.timingSafeEqual` 사용.
 *
 * 토큰 소스 우선순위:
 *   1. process.env.MCP_AUTH_TOKEN (테스트/CI 에서 명시적 주입)
 *   2. ensureMcpToken() — 정상 동작 시 userData/.mcp-token 캐시
 */
import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ensureMcpToken } from '../../lib/mcp-token'

export const AUTH_HEADER = 'x-mcp-token'

interface AuthFailureBody {
  code: 'UNAUTHORIZED'
  error: string
  errorType: 'UnauthorizedError'
}

function getExpectedToken(): string {
  const env = process.env.MCP_AUTH_TOKEN
  if (env && env.length > 0) return env
  return ensureMcpToken()
}

/**
 * 헤더에 든 토큰이 expected token 과 정확히 일치하는지 timing-safe 비교.
 * 길이가 다르면 즉시 false (timingSafeEqual 이 길이 다르면 throw 하므로 사전 차단).
 */
export function verifyToken(headerValue: string | string[] | undefined, expected: string): boolean {
  if (typeof headerValue !== 'string') return false
  if (headerValue.length !== expected.length) return false
  const a = Buffer.from(headerValue, 'utf-8')
  const b = Buffer.from(expected, 'utf-8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * req 의 인증 토큰 검증 결과만 반환. router.ts 의 handle() 진입부에서 호출.
 * → 통과: true, 차단: false (호출 측이 401 응답).
 */
export function isAuthenticated(req: IncomingMessage): boolean {
  const expected = getExpectedToken()
  return verifyToken(req.headers[AUTH_HEADER], expected)
}

/**
 * 401 응답을 표준 포맷으로 작성.
 */
export function writeUnauthorized(res: ServerResponse): void {
  const body: AuthFailureBody = {
    code: 'UNAUTHORIZED',
    error: 'Missing or invalid MCP auth token',
    errorType: 'UnauthorizedError'
  }
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
