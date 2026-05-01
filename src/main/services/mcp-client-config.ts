import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'

export type McpClientId = 'claudeDesktop' | 'claudeCode'

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
}

const SERVER_KEY = is.dev ? 'rally-dev' : 'rally'

function getMcpServerPath(): string {
  return is.dev
    ? join(process.cwd(), 'dist-mcp', 'index.js')
    : join(process.resourcesPath, 'dist-mcp', 'index.js')
}

function buildServerConfig(): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    command: 'node',
    args: [getMcpServerPath()]
  }
  if (is.dev) {
    cfg.env = { RALLY_DEV: '1' }
  }
  return cfg
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
  // claudeCode: ~/.claude.json
  return join(home, '.claude.json')
}

function isClientSupported(client: McpClientId): boolean {
  if (client === 'claudeDesktop') {
    return process.platform === 'darwin' || process.platform === 'win32'
  }
  return true
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
  const config = readConfig(configPath)
  const entry = config.mcpServers?.[SERVER_KEY]
  const registered = !!entry
  let outdated = false
  if (registered && entry) {
    const args = (entry.args as unknown[] | undefined) ?? []
    const currentPath = getMcpServerPath()
    outdated = !args.includes(currentPath)
  }
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
      claudeCode: inspectStatus('claudeCode')
    }
  },

  register(client: McpClientId): McpClientStatus {
    if (!isClientSupported(client)) {
      throw new Error(`${client}는 이 OS에서 지원되지 않습니다`)
    }
    const configPath = getConfigPath(client)
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
    const config = readConfig(configPath)
    if (config.mcpServers && SERVER_KEY in config.mcpServers) {
      delete config.mcpServers[SERVER_KEY]
      writeConfig(configPath, config)
    }
    return inspectStatus(client)
  }
}
