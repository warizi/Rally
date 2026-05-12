/**
 * MCP API 인증 토큰 발급 / 영속화 / 회전.
 *
 * 보안-2 Phase 1.
 *
 * - 256bit (32 bytes) 토큰을 hex 로 직렬화 — 64자 [0-9a-f]
 * - `userData/.mcp-token` 에 저장, 권한 0600 (소유자만 r/w)
 * - 첫 호출 시 발급, 이후 동일 토큰 반환 (디스크 캐시 + 프로세스 캐시)
 * - rotate() 로 강제 재발급
 *
 * Windows 는 ACL 모델이 달라 chmod 가 동작하지 않지만 (`fs.chmodSync` no-op)
 * 사용자 디렉토리 자체가 다른 사용자로부터 격리되어 있어 0600 미적용도 허용.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 256bit (32 bytes) 토큰을 hex 로 생성. 길이 64자.
 */
export function generateMcpToken(): string {
  return randomBytes(32).toString('hex')
}

/** in-memory 캐시 — 같은 프로세스 내 반복 호출 시 디스크 I/O 회피. */
let cachedToken: string | null = null

interface EnsureOptions {
  /** 명시적 저장 경로. 미지정 시 app.getPath('userData')/.mcp-token */
  tokenPath?: string
}

function getDefaultTokenPath(): string {
  // electron app 의존성을 lazy 하게 받아 테스트에서 우회 가능하도록.
  // require 가 sandbox=true 모드의 main 프로세스에서는 무관 (server 측 코드)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron') as typeof import('electron')
  return join(electron.app.getPath('userData'), '.mcp-token')
}

/**
 * 토큰을 보장 — 파일이 있으면 읽어 반환, 없으면 발급 + 저장 + 0600.
 */
export function ensureMcpToken(options: EnsureOptions = {}): string {
  if (cachedToken) return cachedToken

  const tokenPath = options.tokenPath ?? getDefaultTokenPath()

  if (existsSync(tokenPath)) {
    const existing = readFileSync(tokenPath, 'utf-8').trim()
    if (/^[0-9a-f]{64}$/.test(existing)) {
      cachedToken = existing
      return existing
    }
    // 손상된 토큰은 폐기하고 재발급
  }

  const token = generateMcpToken()
  persistToken(tokenPath, token)
  cachedToken = token
  return token
}

/**
 * 토큰을 강제 회전 — 새 토큰 발급 후 디스크/캐시 갱신.
 */
export function rotateMcpToken(options: EnsureOptions = {}): string {
  const tokenPath = options.tokenPath ?? getDefaultTokenPath()
  const token = generateMcpToken()
  persistToken(tokenPath, token)
  cachedToken = token
  return token
}

/**
 * 프로세스 캐시만 비움 — 다음 ensureMcpToken 호출에서 디스크 재로딩.
 * 테스트 격리에 사용.
 */
export function _resetMcpTokenCacheForTests(): void {
  cachedToken = null
}

function persistToken(tokenPath: string, token: string): void {
  mkdirSync(dirname(tokenPath), { recursive: true })
  writeFileSync(tokenPath, token, { encoding: 'utf-8' })
  // Windows 는 fs.chmodSync 가 큰 효과 없지만, 다른 플랫폼은 소유자만 r/w 로 제한.
  if (process.platform !== 'win32') {
    chmodSync(tokenPath, 0o600)
  }
}
