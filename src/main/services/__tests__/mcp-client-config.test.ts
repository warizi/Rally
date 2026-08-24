/**
 * mcp-client-config 단위 테스트.
 *
 * 배포-1: command 가 Electron binary + ELECTRON_RUN_AS_NODE='1' 환경변수로
 * node 의존성 제거. inspectStatus 의 outdated 감지 로직 회귀 차단.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  mkdirSync,
  statSync,
  chmodSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 토큰 모듈 모킹 — 실제 디스크 캐시 무관하게 고정값
// 토큰 모듈 모킹 — 회전 가능한 홀더로 두어 rotateToken 계약을 검증할 수 있게 한다.
vi.mock('../../lib/mcp-token', () => ({
  ensureMcpToken: () => ROTATABLE_TOKEN.current,
  rotateMcpToken: () => {
    ROTATABLE_TOKEN.current = String(++rotateCount).repeat(64).slice(0, 64)
    return ROTATABLE_TOKEN.current
  }
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
/** 현재 유효 토큰 — rotateMcpToken 모킹이 이 값을 바꾼다. */
const ROTATABLE_TOKEN = { current: FAKE_TOKEN }
let rotateCount = 0
const FAKE_ELECTRON_BINARY = '/Applications/Rally.app/Contents/MacOS/Rally'
let tmpHome: string

import { mcpClientConfigService } from '../mcp-client-config'

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'rally-mcp-cfg-'))
  ROTATABLE_TOKEN.current = FAKE_TOKEN
  rotateCount = 0
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
    // path.join 은 OS 별 구분자를 쓰므로 (win32: '\\') 플랫폼 무관하게 비교
    expect((args[0] as string).endsWith(join('dist-mcp', 'index.js'))).toBe(true)
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

describe('claudeDesktop — Windows MSIX 가상화 경로 감지', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    // 실제 머신의 %LOCALAPPDATA%/%APPDATA% 를 보지 않도록 tmpHome 하위로 고정
    vi.stubEnv('LOCALAPPDATA', join(tmpHome, 'AppData', 'Local'))
    vi.stubEnv('APPDATA', join(tmpHome, 'AppData', 'Roaming'))
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    vi.unstubAllEnvs()
  })

  function msixClaudeDir(): string {
    return join(
      tmpHome,
      'AppData',
      'Local',
      'Packages',
      'Claude_pzs8sxrjxfjjc',
      'LocalCache',
      'Roaming',
      'Claude'
    )
  }

  it('MSIX 패키지 미설치 시 %APPDATA% 클래식 경로 사용', () => {
    const status = mcpClientConfigService.getStatus().claudeDesktop
    expect(status.configPath).toBe(
      join(tmpHome, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
    )
  })

  it('MSIX 가상화 디렉터리 존재 시 LocalCache\\Roaming 경로 사용', () => {
    mkdirSync(msixClaudeDir(), { recursive: true })
    const status = mcpClientConfigService.getStatus().claudeDesktop
    expect(status.configPath).toBe(join(msixClaudeDir(), 'claude_desktop_config.json'))
  })

  it('MSIX 경로 register 시 기존 preferences 등 다른 키 보존', () => {
    mkdirSync(msixClaudeDir(), { recursive: true })
    const configPath = join(msixClaudeDir(), 'claude_desktop_config.json')
    writeFileSync(
      configPath,
      JSON.stringify({ preferences: { sidebarMode: 'task' } }, null, 2),
      'utf-8'
    )

    const status = mcpClientConfigService.register('claudeDesktop')
    expect(status.registered).toBe(true)
    expect(status.outdated).toBe(false)

    const cfg = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(cfg.preferences.sidebarMode).toBe('task')
    expect(cfg.mcpServers[mcpClientConfigService.getServerKey()].env.ELECTRON_RUN_AS_NODE).toBe('1')
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

/**
 * 보안-H2 — MCP 설정 파일 권한 회귀 차단.
 *
 * 설정 파일에는 MCP_AUTH_TOKEN 이 평문으로 들어간다 (워크스페이스 전체 읽기/쓰기 가능한
 * 마스터 키). umask 기본값(0644)으로 남으면 같은 머신의 다른 사용자가 읽을 수 있다.
 *
 * 핵심은 "이미 존재하는 파일"도 0600 으로 조여지는가 — writeFileSync 의 mode 옵션은
 * 파일 생성 시에만 적용되므로 옵션만으로는 이 케이스를 못 막는다.
 */
describe.skipIf(process.platform === 'win32')('S-SEC — 설정 파일 권한 0600', () => {
  const modeOf = (p: string): string => (statSync(p).mode & 0o777).toString(8)

  it('claudeCode: 새로 생성한 ~/.claude.json 이 0600', () => {
    const { configPath } = mcpClientConfigService.register('claudeCode')
    expect(existsSync(configPath)).toBe(true)
    expect(modeOf(configPath)).toBe('600')
  })

  it('claudeCode: 이미 0644 로 존재하던 파일도 0600 으로 조여진다', () => {
    const configPath = join(tmpHome, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ projects: { a: 1 } }), 'utf-8')
    chmodSync(configPath, 0o644)
    expect(modeOf(configPath)).toBe('644')

    mcpClientConfigService.register('claudeCode')
    expect(modeOf(configPath)).toBe('600')
  })

  it('codex: TOML 설정도 0600 (등록/해제 양쪽)', () => {
    const configPath = join(tmpHome, '.codex', 'config.toml')
    mkdirSync(join(tmpHome, '.codex'), { recursive: true })
    writeFileSync(configPath, '# user config\n', 'utf-8')
    chmodSync(configPath, 0o644)

    mcpClientConfigService.register('codex')
    expect(modeOf(configPath)).toBe('600')

    chmodSync(configPath, 0o644)
    mcpClientConfigService.unregister('codex')
    expect(modeOf(configPath)).toBe('600')
  })

  it('토큰이 실제로 기록되는 파일이 맞는지 (테스트가 헛돌지 않게)', () => {
    const { configPath } = mcpClientConfigService.register('claudeCode')
    expect(readFileSync(configPath, 'utf-8')).toContain(FAKE_TOKEN)
  })
})

/**
 * 보안-H2 — 토큰 재발급(rotateToken) 회귀 차단.
 *
 * rotateMcpToken() 은 그 전까지 호출부가 없는 dead code 였다. 유출을 인지해도 사용자가
 * 무효화할 수단이 없다는 뜻이었으므로, "재발급이 실제로 구 토큰을 무효화하고 등록된
 * 클라이언트를 새 토큰으로 갱신하는가"가 핵심 계약이다.
 */
describe('S-ROT — 토큰 재발급', () => {
  const tokenIn = (client: 'claudeCode' | 'codex'): string => {
    const p =
      client === 'claudeCode'
        ? join(tmpHome, '.claude.json')
        : join(tmpHome, '.codex', 'config.toml')
    return readFileSync(p, 'utf-8')
  }

  it('등록된 클라이언트가 새 토큰으로 갱신된다', () => {
    mcpClientConfigService.register('claudeCode')
    expect(tokenIn('claudeCode')).toContain(ROTATABLE_TOKEN.current)

    const before = ROTATABLE_TOKEN.current
    const res = mcpClientConfigService.rotateToken()

    expect(ROTATABLE_TOKEN.current).not.toBe(before)
    expect(res.reRegistered).toContain('claudeCode')
    expect(res.failed).toEqual([])
    // 새 토큰으로 교체되고 구 토큰은 파일에서 사라진다
    expect(tokenIn('claudeCode')).toContain(ROTATABLE_TOKEN.current)
    expect(tokenIn('claudeCode')).not.toContain(before)
  })

  it('TOML 클라이언트도 갱신된다', () => {
    mcpClientConfigService.register('codex')
    const before = ROTATABLE_TOKEN.current

    const res = mcpClientConfigService.rotateToken()

    expect(res.reRegistered).toContain('codex')
    expect(tokenIn('codex')).toContain(ROTATABLE_TOKEN.current)
    expect(tokenIn('codex')).not.toContain(before)
  })

  it('미등록 클라이언트는 갱신 대상이 아니다 (없던 설정을 만들지 않는다)', () => {
    const res = mcpClientConfigService.rotateToken()
    expect(res.reRegistered).toEqual([])
    expect(existsSync(join(tmpHome, '.claude.json'))).toBe(false)
    expect(existsSync(join(tmpHome, '.codex', 'config.toml'))).toBe(false)
  })

  it('갱신된 설정 파일은 0600 을 유지한다', () => {
    if (process.platform === 'win32') return
    mcpClientConfigService.register('claudeCode')
    chmodSync(join(tmpHome, '.claude.json'), 0o644)

    mcpClientConfigService.rotateToken()
    expect((statSync(join(tmpHome, '.claude.json')).mode & 0o777).toString(8)).toBe('600')
  })

  it('재발급 후 status 는 outdated=false (새 토큰 기준으로 다시 판정)', () => {
    mcpClientConfigService.register('claudeCode')
    const res = mcpClientConfigService.rotateToken()
    expect(res.status.claudeCode.registered).toBe(true)
    expect(res.status.claudeCode.outdated).toBe(false)
  })
})
