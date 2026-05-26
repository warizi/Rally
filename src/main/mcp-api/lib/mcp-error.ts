import { LockedError } from '../../lib/errors'

/**
 * MCP per-action 응답에 들어갈 { code, message } 를 만든다.
 * - LockedError → code 'LOCKED' (AI 클라이언트가 자동 재시도 않도록 stable 코드 사용)
 * - 그 외 Error → constructor.name (기존 호환)
 */
export function mcpErrorBody(e: unknown): { code: string; message: string } {
  if (e instanceof LockedError) {
    return { code: 'LOCKED', message: e.message }
  }
  const err = e as Error
  return { code: err.constructor.name, message: err.message }
}
