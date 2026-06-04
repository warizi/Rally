/**
 * mcp-client-config 단위 테스트.
 *
 * 배포-1: command 가 Electron binary + ELECTRON_RUN_AS_NODE='1' 환경변수로
 * node 의존성 제거. inspectStatus 의 outdated 감지 로직 회귀 차단.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 토큰 모듈 모킹 — 실제 디스크 캐시 무관하게 고정값
vi.mock('../../lib/mcp-token', () => ({
  ensureMcpToken: () => FAKE_TOKEN
}))

// Electron app 모킹 — 테스트 환경에서 실제 binary 경로 대신 fake 사용
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'exe') return FAKE_ELECTRON_BINARY
      if (name === 'home') return tmpHome
      if (name === 'userData') return join(tmpHome, '.userData')
      return tmpHome
    }
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true } // dev 모드 가정 — SERVER_KEY = 'rally-dev'
}))

const FAKE_TOKEN = 'a'.repeat(64)
const FAKE_ELECTRON_BINARY = '/Applications/Rally.app/Contents/MacOS/Rally'
let tmpHome: string

import { mcpClientConfigService } from '../mcp-client-config'

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'rally-mcp-cfg-'))
})

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true })
})

describe('S1 — getServerConfig', () => {
  it('command 는 Electron binary (app.getPath exe)', () => {
    const cfg = mcpClientConfigService.getServerConfig()
    expect(cfg.command).toBe(FAKE_ELECTRON_BINARY)
  })

  it('command 가 시스템 "node" 명령에 의존하지 않는다', () => {
    const cfg = mcpClientConfigService.getServerConfig()
    expect(cfg.command).not.toBe('node')
  })

  it('env 에 ELECTRON_RUN_AS_NODE=1 + MCP_AUTH_TOKEN 포함', () => {
    const cfg = mcpClientConfigService.getServerConfig() as Record<string, unknown>
    const env = cfg.env as Record<string, string>
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(env.MCP_AUTH_TOKEN).toBe(FAKE_TOKEN)
  })

  it('args 는 dist-mcp/index.js 절대경로 1개', () => {
    const cfg = mcpClientConfigService.getServerConfig() as Record<string, unknown>
    const args = cfg.args as unknown[]
    expect(args.length).toBe(1)
    expect((args[0] as string).endsWith('dist-mcp/index.js')).toBe(true)
  })
})

describe('S2 — inspectStatus outdated 감지', () => {
  // claudeCode config 경로: ~/.claude.json
  function configPath(): string {
    return join(tmpHome, '.claude.json')
  }

  function writeRallyEntry(entry: Record<string, unknown>): void {
    const SERVER_KEY = mcpClientConfigService.getServerKey()
    writeFileSync(
      configPath(),
      JSON.stringify({ mcpServers: { [SERVER_KEY]: entry } }, null, 2),
      'utf-8'
    )
  }

  it('이전 command="node" 등록은 outdated 로 표시', () => {
    const current = mcpClientConfigService.getServerConfig() as Record<string, unknown>
    writeRallyEntry({
      command: 'node', // 구버전
      args: current.args,
      env: current.env
    })
    const status = mcpClientConfigService.getStatus().claudeCode
    expect(status.registered).toBe(true)
    expect(status.outdated).toBe(true)
  })

  it('ELECTRON_RUN_AS_NODE 누락된 entry 는 outdated', () => {
    const current = mcpClientConfigService.getServerConfig() as Record<string, unknown>
    const env = { ...(current.env as Record<string, string>) }
    delete env.ELECTRON_RUN_AS_NODE
    writeRallyEntry({
      command: current.command,
      args: current.args,
      env
    })
    const status = mcpClientConfigService.getStatus().claudeCode
    expect(status.outdated).toBe(true)
  })

  it('완전히 동일한 entry 는 outdated=false', () => {
    const current = mcpClientConfigService.getServerConfig()
    writeRallyEntry(current)
    const status = mcpClientConfigService.getStatus().claudeCode
    expect(status.registered).toBe(true)
    expect(status.outdated).toBe(false)
  })
})

describe('register / unregister 라운드트립', () => {
  it('register 시 config 파일에 ELECTRON_RUN_AS_NODE entry 작성', () => {
    const status = mcpClientConfigService.register('claudeCode')
    expect(status.registered).toBe(true)
    expect(status.outdated).toBe(false)

    const SERVER_KEY = mcpClientConfigService.getServerKey()
    const path = join(tmpHome, '.claude.json')
    expect(existsSync(path)).toBe(true)
    const cfg = JSON.parse(readFileSync(path, 'utf-8'))
    const entry = cfg.mcpServers[SERVER_KEY]
    expect(entry.command).toBe(FAKE_ELECTRON_BINARY)
    expect(entry.env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(entry.env.MCP_AUTH_TOKEN).toBe(FAKE_TOKEN)
  })

  it('unregister 시 entry 제거됨', () => {
    mcpClientConfigService.register('claudeCode')
    mcpClientConfigService.unregister('claudeCode')
    const status = mcpClientConfigService.getStatus().claudeCode
    expect(status.registered).toBe(false)
  })
})

describe('codex — TOML config.toml 라운드트립', () => {
  // codex config 경로: ~/.codex/config.toml
  function configPath(): string {
    return join(tmpHome, '.codex', 'config.toml')
  }

  it('codex 는 모든 OS 에서 supported', () => {
    const status = mcpClientConfigService.getStatus().codex
    expect(status.supported).toBe(true)
    expect(status.configPath).toBe(configPath())
  })

  it('register 시 TOML 블록 작성 + registered/outdated=false', () => {
    const status = mcpClientConfigService.register('codex')
    expect(status.registered).toBe(true)
    expect(status.outdated).toBe(false)

    const SERVER_KEY = mcpClientConfigService.getServerKey()
    const raw = readFileSync(configPath(), 'utf-8')
    expect(raw).toContain(`[mcp_servers.${SERVER_KEY}]`)
    expect(raw).toContain(`[mcp_servers.${SERVER_KEY}.env]`)
    expect(raw).toContain(`command = "${FAKE_ELECTRON_BINARY}"`)
    expect(raw).toContain('ELECTRON_RUN_AS_NODE = "1"')
    expect(raw).toContain(`MCP_AUTH_TOKEN = "${FAKE_TOKEN}"`)
  })

  it('register 가 기존 사용자 설정을 보존', () => {
    mkdirSync(join(tmpHome, '.codex'), { recursive: true })
    writeFileSync(
      configPath(),
      '# my config\nmodel = "gpt-5-codex"\n\n[mcp_servers.context7]\ncommand = "npx"\n',
      'utf-8'
    )
    mcpClientConfigService.register('codex')
    const raw = readFileSync(configPath(), 'utf-8')
    expect(raw).toContain('# my config')
    expect(raw).toContain('model = "gpt-5-codex"')
    expect(raw).toContain('[mcp_servers.context7]')
    expect(mcpClientConfigService.getStatus().codex.registered).toBe(true)
  })

  it('이전 command="node" TOML 등록은 outdated', () => {
    const SERVER_KEY = mcpClientConfigService.getServerKey()
    const current = mcpClientConfigService.getServerConfig() as Record<string, unknown>
    const args = current.args as string[]
    mkdirSync(join(tmpHome, '.codex'), { recursive: true })
    writeFileSync(
      configPath(),
      [
        `[mcp_servers.${SERVER_KEY}]`,
        'command = "node"',
        `args = ["${args[0]}"]`,
        '',
        `[mcp_servers.${SERVER_KEY}.env]`,
        'ELECTRON_RUN_AS_NODE = "1"',
        `MCP_AUTH_TOKEN = "${FAKE_TOKEN}"`
      ].join('\n'),
      'utf-8'
    )
    const status = mcpClientConfigService.getStatus().codex
    expect(status.registered).toBe(true)
    expect(status.outdated).toBe(true)
  })

  it('unregister 시 블록 제거 (다른 서버는 유지)', () => {
    mkdirSync(join(tmpHome, '.codex'), { recursive: true })
    writeFileSync(configPath(), '[mcp_servers.context7]\ncommand = "npx"\n', 'utf-8')
    mcpClientConfigService.register('codex')
    mcpClientConfigService.unregister('codex')
    const status = mcpClientConfigService.getStatus().codex
    expect(status.registered).toBe(false)
    expect(readFileSync(configPath(), 'utf-8')).toContain('[mcp_servers.context7]')
  })
})
