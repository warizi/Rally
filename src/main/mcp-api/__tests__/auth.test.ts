/**
 * MCP API 인증 미들웨어 단위 테스트.
 * 보안-2 Phase 2.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTH_HEADER, verifyToken } from '../lib/auth'
import { createRouter } from '../router'
import { makeReq, makeRes } from './setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64) // 64자 hex 형식의 dummy

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) {
    delete process.env.MCP_AUTH_TOKEN
  } else {
    process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
  }
})

describe('verifyToken (timing-safe 비교)', () => {
  it('정상 토큰 일치 → true', () => {
    expect(verifyToken(TEST_TOKEN, TEST_TOKEN)).toBe(true)
  })

  it('잘못된 토큰 → false', () => {
    expect(verifyToken('wrong-token-of-different-length', TEST_TOKEN)).toBe(false)
  })

  it('길이는 같지만 다른 토큰 → false', () => {
    const other = 'b'.repeat(64)
    expect(verifyToken(other, TEST_TOKEN)).toBe(false)
  })

  it('undefined 헤더 → false', () => {
    expect(verifyToken(undefined, TEST_TOKEN)).toBe(false)
  })

  it('배열 헤더 (중복) → false', () => {
    expect(verifyToken([TEST_TOKEN, TEST_TOKEN], TEST_TOKEN)).toBe(false)
  })
})

describe('router handle() 인증 통합', () => {
  it('S1 — 헤더 누락 시 401 + UnauthorizedError', async () => {
    const router = createRouter()
    router.addRoute('GET', '/test', () => ({ ok: true }))

    const req = makeReq({ url: '/test' })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(401)
    const body = cap.getJson<{ code: string; errorType: string }>()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.errorType).toBe('UnauthorizedError')
  })

  it('S2 — 잘못된 토큰 → 401', async () => {
    const router = createRouter()
    router.addRoute('GET', '/test', () => ({ ok: true }))

    const req = makeReq({ url: '/test', headers: { [AUTH_HEADER]: 'wrong' } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(401)
  })

  it('S3 — 정상 토큰 → 200 + handler 결과', async () => {
    const router = createRouter()
    router.addRoute('GET', '/test', () => ({ ok: true }))

    const req = makeReq({ url: '/test', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ ok: boolean }>()
    expect(body.ok).toBe(true)
  })

  it('S4 — 라우트 매칭 실패해도 인증은 통과해야 404 도달', async () => {
    const router = createRouter()

    const req = makeReq({
      url: '/nonexistent',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
  })

  it('인증 실패 시 handler 가 호출되지 않음 (조기 차단)', async () => {
    let handlerCalled = false
    const router = createRouter()
    router.addRoute('GET', '/test', () => {
      handlerCalled = true
      return { ok: true }
    })

    const req = makeReq({ url: '/test' })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(handlerCalled).toBe(false)
    expect(cap.getStatusCode()).toBe(401)
  })
})

describe('auth.ts 소스 정적 검증 (timing attack 회귀 차단)', () => {
  it('crypto.timingSafeEqual 을 사용한다', () => {
    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const src = readFileSync(resolve(__dirname, '../lib/auth.ts'), 'utf-8')
    expect(src).toMatch(/timingSafeEqual/)
  })
})
