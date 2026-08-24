/**
 * 보안-H2 — 설정 화면 토큰 마스킹 회귀 차단.
 *
 * 핵심 계약 두 가지:
 *   1) 표시용 값에는 토큰 원문이 절대 남지 않는다
 *   2) 복사용(원본)은 손대지 않는다 — 마스킹된 값을 붙여넣으면 등록이 동작하지 않는다
 */
import { describe, it, expect } from 'vitest'
import { maskServerConfig, hasSecret, MASKED_TOKEN } from '../mask-mcp-token'

const TOKEN = 'f'.repeat(64)
const config = (): Record<string, unknown> => ({
  command: '/Applications/Rally.app/Contents/MacOS/Rally',
  args: ['/path/dist-mcp/index.js'],
  env: { ELECTRON_RUN_AS_NODE: '1', MCP_AUTH_TOKEN: TOKEN }
})

describe('maskServerConfig', () => {
  it('reveal=false 면 MCP_AUTH_TOKEN 이 자리표시자로 바뀐다', () => {
    const masked = maskServerConfig(config(), false)
    const env = masked?.env as Record<string, string>
    expect(env.MCP_AUTH_TOKEN).toBe(MASKED_TOKEN)
  })

  it('직렬화 결과 어디에도 토큰 원문이 남지 않는다', () => {
    const masked = maskServerConfig(config(), false)
    expect(JSON.stringify(masked)).not.toContain(TOKEN)
  })

  it('reveal=true 면 원본을 그대로 돌려준다', () => {
    const original = config()
    expect(maskServerConfig(original, true)).toBe(original)
  })

  it('원본 객체를 변형하지 않는다 (복사 경로 보호)', () => {
    const original = config()
    maskServerConfig(original, false)
    expect((original.env as Record<string, string>).MCP_AUTH_TOKEN).toBe(TOKEN)
  })

  it('비밀이 아닌 env 값은 건드리지 않는다', () => {
    const masked = maskServerConfig(config(), false)
    const env = masked?.env as Record<string, string>
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
  })

  it('command / args 는 그대로 유지된다', () => {
    const masked = maskServerConfig(config(), false)
    expect(masked?.command).toBe(config().command)
    expect(masked?.args).toEqual(config().args)
  })

  it('null / env 없음 / 빈 토큰은 안전하게 통과', () => {
    expect(maskServerConfig(null, false)).toBeNull()
    const noEnv = { command: 'node', args: [] }
    expect(maskServerConfig(noEnv, false)).toBe(noEnv)
    const emptyToken = { command: 'node', args: [], env: { MCP_AUTH_TOKEN: '' } }
    expect(maskServerConfig(emptyToken, false)).toBe(emptyToken)
  })
})

describe('hasSecret — 표시 토글 노출 판단', () => {
  it('토큰이 있으면 true', () => {
    expect(hasSecret(config())).toBe(true)
  })

  it('토큰이 없거나 비어 있으면 false (가릴 게 없는데 토글을 띄우지 않는다)', () => {
    expect(hasSecret(null)).toBe(false)
    expect(hasSecret({ command: 'node', args: [] })).toBe(false)
    expect(hasSecret({ command: 'node', args: [], env: { MCP_AUTH_TOKEN: '' } })).toBe(false)
    expect(hasSecret({ command: 'node', args: [], env: { ELECTRON_RUN_AS_NODE: '1' } })).toBe(false)
  })
})
