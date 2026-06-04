import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { ensureMcpToken } from '../lib/mcp-token'
import {
  readEntry as readCodexEntry,
  removeEntry as removeCodexEntry,
  upsertEntry as upsertCodexEntry,
  type CodexMcpEntry
} from './codex-toml'

// codex: Codex CLI 와 Desktop(IDE 확장) 이 ~/.codex/config.toml 을 공유하므로 단일 클라이언트로 취급.
export type McpClientId = 'claudeDesktop' | 'claudeCode' | 'codex'

export interface McpClientStatus {
  /** 클라이언트별 설정 파일 경로 */
  configPath: string
  /** 해당 OS에서 지원되는 클라이언트인지 */
  supported: boolean
  /** 설정 파일이 이미 존재하는지 */
  configExists: boolean
  /** rally 서버가 등록되어 있는지 */
  registered: boolean
  /** 등록은 되어 있지만 경로가 현재 앱과 다른지 (구버전 등) */
  outdated: boolean
}

export interface McpClientStatusMap {
  claudeDesktop: McpClientStatus
  claudeCode: McpClientStatus
  codex: McpClientStatus
}

/** 클라이언트별 설정 파일 포맷 — Claude 는 JSON, Codex 는 TOML */
type ConfigFormat = 'json' | 'toml'

function getConfigFormat(client: McpClientId): ConfigFormat {
  return client === 'codex' ? 'toml' : 'json'
}

const SERVER_KEY = is.dev ? 'rally-dev' : 'rally'

function getMcpServerPath(): string {
  return is.dev
    ? join(process.cwd(), 'dist-mcp', 'index.js')
    : join(process.resourcesPath, 'dist-mcp', 'index.js')
}

function buildServerConfig(): Record<string, unknown> {
  // 배포-1: 사용자 시스템에 node 가 설치되어 있지 않아도 동작하도록 Electron 의
  // 내장 Node 를 사용한다. ELECTRON_RUN_AS_NODE=1 환경변수와 함께 Electron binary
  // 를 spawn 하면 GUI 없이 표준 Node embedding 으로 동작 (Electron 공식 지원).
  //
  // 보안-2: 클라이언트가 rally MCP API 에 접근할 때 사용할 인증 토큰을
  // env 로 자동 주입. 사용자가 토큰을 수동 복사할 필요 없음.
  const env: Record<string, string> = {
    ELECTRON_RUN_AS_NODE: '1',
    MCP_AUTH_TOKEN: ensureMcpToken()
  }
  if (is.dev) {
    env.RALLY_DEV = '1'
  }
  return {
    command: app.getPath('exe'),
    args: [getMcpServerPath()],
    env
  }
}

function getConfigPath(client: McpClientId): string {
  const home = app.getPath('home')
  if (client === 'claudeDesktop') {
    if (process.platform === 'darwin') {
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    }
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
      return join(appData, 'Claude', 'claude_desktop_config.json')
    }
    // Linux: 비공식 경로지만 일부 사용자 사용
    return join(home, '.config', 'Claude', 'claude_desktop_config.json')
  }
  if (client === 'codex') {
    // Codex CLI + Desktop(IDE) 공유 설정
    return join(home, '.codex', 'config.toml')
  }
  // claudeCode: ~/.claude.json
  return join(home, '.claude.json')
}

function isClientSupported(client: McpClientId): boolean {
  if (client === 'claudeDesktop') {
    return process.platform === 'darwin' || process.platform === 'win32'
  }
  // claudeCode, codex: 모든 OS 지원 (CLI 기반)
  return true
}

/** buildServerConfig() 의 Record 를 codex-toml 의 엔트리 형태로 변환 */
function toEntry(serverConfig: Record<string, unknown>): CodexMcpEntry {
  return {
    command: serverConfig.command as string,
    args: (serverConfig.args as string[]) ?? [],
    env: (serverConfig.env as Record<string, string>) ?? {}
  }
}

/**
 * 등록된 entry 가 현재 앱 기준과 다른지 (포맷 무관 공통 로직).
 * - command 가 현재 Electron binary 와 다름 (구버전 'node' 등)
 * - ELECTRON_RUN_AS_NODE 누락
 * - 현재 dist-mcp 경로가 args 에 없음
 * - MCP_AUTH_TOKEN 불일치
 */
function isEntryOutdated(entry: {
  command?: string
  args?: string[]
  env?: Record<string, string>
}): boolean {
  const args = entry.args ?? []
  const env = entry.env ?? {}
  return (
    entry.command !== app.getPath('exe') ||
    env.ELECTRON_RUN_AS_NODE !== '1' ||
    !args.includes(getMcpServerPath()) ||
    env.MCP_AUTH_TOKEN !== ensureMcpToken()
  )
}

function safeReadText(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

interface ConfigShape {
  mcpServers?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}

function readConfig(configPath: string): ConfigShape {
  if (!existsSync(configPath)) return {}
  try {
    const raw = readFileSync(configPath, 'utf-8')
    if (!raw.trim()) return {}
    return JSON.parse(raw) as ConfigShape
  } catch {
    return {}
  }
}

function writeConfig(configPath: string, config: ConfigShape): void {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function inspectStatus(client: McpClientId): McpClientStatus {
  const supported = isClientSupported(client)
  const configPath = getConfigPath(client)
  if (!supported) {
    return { configPath, supported: false, configExists: false, registered: false, outdated: false }
  }
  const configExists = existsSync(configPath)
  if (!configExists) {
    return { configPath, supported: true, configExists: false, registered: false, outdated: false }
  }

  if (getConfigFormat(client) === 'toml') {
    // 배포-1/보안-2 의 outdated 감지 로직을 TOML 엔트리에도 동일 적용.
    const entry = readCodexEntry(safeReadText(configPath), SERVER_KEY)
    const registered = !!entry
    const outdated = registered ? isEntryOutdated(entry) : false
    return { configPath, supported: true, configExists, registered, outdated }
  }

  const config = readConfig(configPath)
  const entry = config.mcpServers?.[SERVER_KEY]
  const registered = !!entry
  const outdated =
    registered && entry
      ? isEntryOutdated(
          entry as { command?: string; args?: string[]; env?: Record<string, string> }
        )
      : false
  return { configPath, supported: true, configExists, registered, outdated }
}

export const mcpClientConfigService = {
  /** dev: 'rally-dev' / prod: 'rally' */
  getServerKey(): string {
    return SERVER_KEY
  },

  getServerConfig(): Record<string, unknown> {
    return buildServerConfig()
  },

  getStatus(): McpClientStatusMap {
    return {
      claudeDesktop: inspectStatus('claudeDesktop'),
      claudeCode: inspectStatus('claudeCode'),
      codex: inspectStatus('codex')
    }
  },

  register(client: McpClientId): McpClientStatus {
    if (!isClientSupported(client)) {
      throw new Error(`${client}는 이 OS에서 지원되지 않습니다`)
    }
    const configPath = getConfigPath(client)

    if (getConfigFormat(client) === 'toml') {
      // 기존 config.toml 의 사용자 설정(주석·포맷)을 보존하며 rally 블록만 교체.
      const current = existsSync(configPath) ? safeReadText(configPath) : ''
      const next = upsertCodexEntry(current, SERVER_KEY, toEntry(buildServerConfig()))
      mkdirSync(dirname(configPath), { recursive: true })
      writeFileSync(configPath, next, 'utf-8')
      return inspectStatus(client)
    }

    const config = readConfig(configPath)
    if (!config.mcpServers) config.mcpServers = {}
    config.mcpServers[SERVER_KEY] = buildServerConfig()
    writeConfig(configPath, config)
    return inspectStatus(client)
  },

  unregister(client: McpClientId): McpClientStatus {
    if (!isClientSupported(client)) {
      throw new Error(`${client}는 이 OS에서 지원되지 않습니다`)
    }
    const configPath = getConfigPath(client)
    if (!existsSync(configPath)) return inspectStatus(client)

    if (getConfigFormat(client) === 'toml') {
      const current = safeReadText(configPath)
      const next = removeCodexEntry(current, SERVER_KEY)
      if (next !== current) writeFileSync(configPath, next, 'utf-8')
      return inspectStatus(client)
    }

    const config = readConfig(configPath)
    if (config.mcpServers && SERVER_KEY in config.mcpServers) {
      delete config.mcpServers[SERVER_KEY]
      writeConfig(configPath, config)
    }
    return inspectStatus(client)
  }
}
