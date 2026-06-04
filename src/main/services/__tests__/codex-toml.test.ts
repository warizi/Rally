/**
 * codex-toml 단위 테스트.
 *
 * Codex (~/.codex/config.toml) 의 MCP 엔트리만 surgical 하게 다루는지,
 * 사용자의 나머지 설정(주석·포맷·다른 서버)을 보존하는지 round-trip 으로 검증한다.
 */
import { describe, it, expect } from 'vitest'
import {
  serializeEntry,
  readEntry,
  upsertEntry,
  removeEntry,
  type CodexMcpEntry
} from '../codex-toml'

const ENTRY: CodexMcpEntry = {
  command: '/Applications/Rally.app/Contents/MacOS/Rally',
  args: ['/opt/rally/dist-mcp/index.js'],
  env: { ELECTRON_RUN_AS_NODE: '1', MCP_AUTH_TOKEN: 'a'.repeat(64) }
}

describe('serializeEntry / readEntry round-trip', () => {
  it('직렬화 후 다시 읽으면 동일한 엔트리', () => {
    const toml = serializeEntry('rally', ENTRY)
    const parsed = readEntry(toml, 'rally')
    expect(parsed).toEqual(ENTRY)
  })

  it('main + env 서브테이블 헤더를 생성', () => {
    const toml = serializeEntry('rally', ENTRY)
    expect(toml).toContain('[mcp_servers.rally]')
    expect(toml).toContain('[mcp_servers.rally.env]')
    expect(toml).toContain('command = "/Applications/Rally.app/Contents/MacOS/Rally"')
  })

  it('하이픈 포함 키(rally-dev)도 처리', () => {
    const toml = serializeEntry('rally-dev', ENTRY)
    expect(toml).toContain('[mcp_servers.rally-dev]')
    expect(readEntry(toml, 'rally-dev')).toEqual(ENTRY)
  })

  it('Windows 경로의 역슬래시를 이스케이프하고 복원', () => {
    const win: CodexMcpEntry = {
      command: 'C:\\Program Files\\Rally\\Rally.exe',
      args: ['C:\\Program Files\\Rally\\dist-mcp\\index.js'],
      env: { MCP_AUTH_TOKEN: 'x' }
    }
    const toml = serializeEntry('rally', win)
    expect(toml).toContain('\\\\')
    expect(readEntry(toml, 'rally')).toEqual(win)
  })
})

describe('upsertEntry — 기존 설정 보존', () => {
  const existing = [
    '# 사용자 코멘트',
    'model = "gpt-5-codex"',
    'approval_policy = "on-request"',
    '',
    '[mcp_servers.context7]',
    'command = "npx"',
    'args = ["-y", "@upstash/context7-mcp"]',
    ''
  ].join('\n')

  it('빈 파일에 추가', () => {
    const next = upsertEntry('', 'rally', ENTRY)
    expect(readEntry(next, 'rally')).toEqual(ENTRY)
  })

  it('다른 서버/주석/최상위 키를 보존하면서 rally 추가', () => {
    const next = upsertEntry(existing, 'rally', ENTRY)
    expect(next).toContain('# 사용자 코멘트')
    expect(next).toContain('model = "gpt-5-codex"')
    expect(next).toContain('[mcp_servers.context7]')
    expect(readEntry(next, 'rally')).toEqual(ENTRY)
    // context7 도 그대로 읽혀야 함
    const ctx = readEntry(next, 'context7')
    expect(ctx?.command).toBe('npx')
    expect(ctx?.args).toEqual(['-y', '@upstash/context7-mcp'])
  })

  it('재등록(upsert) 시 중복 블록이 생기지 않음', () => {
    let next = upsertEntry(existing, 'rally', ENTRY)
    const updated: CodexMcpEntry = { ...ENTRY, args: ['/new/path/index.js'] }
    next = upsertEntry(next, 'rally', updated)
    const headerCount = next.split('[mcp_servers.rally]').length - 1
    expect(headerCount).toBe(1)
    expect(readEntry(next, 'rally')).toEqual(updated)
  })
})

describe('removeEntry', () => {
  it('rally 블록만 제거하고 나머지 보존', () => {
    const withRally = upsertEntry('[mcp_servers.context7]\ncommand = "npx"\n', 'rally', ENTRY)
    const removed = removeEntry(withRally, 'rally')
    expect(readEntry(removed, 'rally')).toBeNull()
    expect(removed).toContain('[mcp_servers.context7]')
  })

  it('없는 키 제거는 원본 유지', () => {
    const src = '[mcp_servers.context7]\ncommand = "npx"\n'
    expect(removeEntry(src, 'rally')).toBe(src)
  })
})

describe('readEntry 폴백', () => {
  it('인라인 env 테이블도 파싱', () => {
    const toml = [
      '[mcp_servers.rally]',
      'command = "/bin/rally"',
      'args = ["/x/index.js"]',
      'env = { ELECTRON_RUN_AS_NODE = "1", MCP_AUTH_TOKEN = "tok" }'
    ].join('\n')
    const parsed = readEntry(toml, 'rally')
    expect(parsed?.env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(parsed?.env.MCP_AUTH_TOKEN).toBe('tok')
  })

  it('등록 안된 키는 null', () => {
    expect(readEntry('model = "x"\n', 'rally')).toBeNull()
  })
})
