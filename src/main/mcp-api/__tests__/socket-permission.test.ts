/**
 * MCP API socket 권한 회귀 차단 테스트.
 *
 * 보안-2 Phase 3 — 실제 listen 통합 테스트는 better-sqlite3 / electron 의존성과
 * 포트 충돌 위험이 있어 정적 검증으로 server.ts 가 fs.chmodSync(path, 0o600) 을
 * 호출하는지 확인.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const serverSrc = readFileSync(resolve(__dirname, '../server.ts'), 'utf-8')

describe('MCP API server.ts socket 권한 정적 검증', () => {
  it('listen 콜백에서 fs.chmodSync(socketPath, 0o600) 호출', () => {
    expect(serverSrc).toMatch(/fs\.chmodSync\(\s*socketPath\s*,\s*0o600\s*\)/)
  })

  it('Windows (win32) 에서는 chmod skip (ACL 모델 차이)', () => {
    // chmod 호출은 process.platform 검사 후 분기 안에 있어야 한다.
    expect(serverSrc).toMatch(/process\.platform\s*!==\s*['"]win32['"]/)
  })

  it('chmod 실패는 try/catch 로 흡수 (서버 시작은 막지 않음)', () => {
    expect(serverSrc).toMatch(/try\s*\{[^}]*fs\.chmodSync/s)
  })
})
