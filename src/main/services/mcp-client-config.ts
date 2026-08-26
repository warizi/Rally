import { app } from 'electron'
import { join, dirname } from 'path'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { is } from '@electron-toolkit/utils'
import { ensureMcpToken, rotateMcpToken } from '../lib/mcp-token'
import { scoped } from '../lib/logger'
import { PermissionError, ValidationError } from '../lib/errors'
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

/** 토큰 재발급 결과 — 갱신 성공/실패를 삼키지 않고 호출 측에 그대로 보고한다. */
export interface McpRotateResult {
  status: McpClientStatusMap
  /** 새 토큰으로 설정을 다시 쓴 클라이언트 */
  reRegistered: McpClientId[]
  /** 갱신에 실패한 클라이언트 — 구 토큰이 남아 있으므로 사용자가 수동 조치해야 한다 */
  failed: { client: McpClientId; error: string }[]
}

/** 클라이언트별 설정 파일 포맷 — Claude 는 JSON, Codex 는 TOML */
type ConfigFormat = 'json' | 'toml'

function getConfigFormat(client: McpClientId): ConfigFormat {
  return client === 'codex' ? 'toml' : 'json'
}

const log = scoped('mcp-client-config')

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

/**
 * Windows MSIX(Microsoft Store) 설치판 Claude Desktop 의 가상화 AppData 경로 감지.
 *
 * MSIX 패키지 앱은 AppData 가상화(copy-on-write) 로 %APPDATA%\Claude 대신
 * %LOCALAPPDATA%\Packages\Claude_<hash>\LocalCache\Roaming\Claude 를 읽는다.
 * 이 경로가 존재하면 %APPDATA% 에 써도 Claude Desktop 이 절대 읽지 않으므로
 * 반드시 가상화 경로를 사용해야 한다.
 */
function findWindowsMsixClaudeDir(home: string): string | null {
  const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
  const packagesDir = join(localAppData, 'Packages')
  try {
    for (const name of readdirSync(packagesDir)) {
      if (!name.startsWith('Claude_')) continue
      const claudeDir = join(packagesDir, name, 'LocalCache', 'Roaming', 'Claude')
      if (existsSync(claudeDir)) return claudeDir
    }
  } catch {
    // Packages 디렉터리 없음/접근 불가 → 클래식(NSIS) 설치로 간주
  }
  return null
}

function getConfigPath(client: McpClientId): string {
  const home = app.getPath('home')
  if (client === 'claudeDesktop') {
    if (process.platform === 'darwin') {
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    }
    if (process.platform === 'win32') {
      const msixDir = findWindowsMsixClaudeDir(home)
      if (msixDir) return join(msixDir, 'claude_desktop_config.json')
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

/* ------------------------------------------------------------------ */
/* 읽기 — 조회용(관대)과 쓰기 전용(엄격)을 분리한다                      */
/*                                                                      */
/* M-2: 이 파일들은 Rally 것이 아니다. ~/.claude.json 에는 사용자의 프로젝트  */
/* 이력·다른 MCP 서버 목록·설정이 전부 들어 있고, ~/.codex/config.toml 에도   */
/* 사용자의 주석과 설정이 들어 있다.                                      */
/*                                                                      */
/* 읽기에 실패했는데 "빈 값"으로 간주하고 쓰면, 우리가 rally 블록만 얹은      */
/* 파일로 원본을 통째로 교체하게 된다 — 복구 불가능한 파괴다. 그래서 쓰기     */
/* 경로에서는 절대 빈 값으로 대체하지 않고 throw 한다.                      */
/*                                                                      */
/* 반면 상태 조회(inspectStatus)는 화면 표시용이라 실패해도 앱이 멈추면 안    */
/* 되므로 관대한 쪽을 쓴다.                                              */
/* ------------------------------------------------------------------ */

/** 조회용 — 실패를 "내용 없음"으로 흡수한다. 쓰기 경로에서 쓰지 말 것. */
function safeReadText(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * 쓰기 전용 — 파일이 있는데 읽지 못하면 throw.
 * 파일이 없을 때만 '' (신규 생성)이 정당하다.
 */
function readTextForWrite(filePath: string): string {
  if (!existsSync(filePath)) return ''
  try {
    return readFileSync(filePath, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    throw new PermissionError(
      `설정 파일을 읽을 수 없어 안전하게 수정할 수 없습니다 (${code ?? 'unknown'}): ${filePath}\n` +
        `파일 권한을 확인하거나, 해당 파일을 사용 중인 프로그램을 종료한 뒤 다시 시도해 주세요.`
    )
  }
}

interface ConfigShape {
  mcpServers?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}

/** 조회용 — 손상된 파일도 빈 설정으로 취급해 상태 화면이 죽지 않게 한다. */
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

/**
 * 쓰기 전용 — 읽기 실패는 PermissionError, JSON 파싱 실패는 ValidationError.
 * 어느 쪽이든 호출 측이 파일을 덮어쓰지 못하게 막는 것이 목적이다.
 */
function readConfigForWrite(configPath: string): ConfigShape {
  const raw = readTextForWrite(configPath)
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw) as ConfigShape
  } catch (err) {
    throw new ValidationError(
      `설정 파일이 올바른 JSON 이 아니어서 안전하게 수정할 수 없습니다: ${configPath}\n` +
        `그대로 진행하면 기존 설정이 사라지므로 중단했습니다. 파일을 고친 뒤 다시 시도해 주세요.\n` +
        `(원인: ${err instanceof Error ? err.message : String(err)})`
    )
  }
}

/**
 * 보안-H2: MCP 설정 파일을 소유자 전용(0600)으로 제한한다.
 *
 * 이 파일들에는 `MCP_AUTH_TOKEN` 이 평문으로 들어간다 — 워크스페이스 전체
 * 읽기/쓰기가 가능한 마스터 키다. 원본 `userData/.mcp-token` 은 0600 을 지키는데
 * 복사본이 umask 기본값(보통 0644, 타 사용자 읽기 가능)으로 남으면 방어가 새어버린다.
 *
 * `writeFileSync(..., { mode })` 를 쓰지 않는 이유: mode 는 파일을 **생성할 때만**
 * 적용된다. `~/.claude.json` 처럼 이미 존재하는 파일은 기존 권한을 그대로 유지하므로
 * 옵션만으로는 no-op 이다. 따라서 쓰기 후 chmod 로 강제한다 (mcp-token.ts 와 동일 규약).
 *
 * Windows 는 chmodSync 가 사실상 no-op 이고 사용자 프로필 디렉터리가 이미 격리되어
 * 있으므로 건너뛴다.
 */
function restrictToOwner(filePath: string): void {
  if (process.platform === 'win32') return
  try {
    chmodSync(filePath, 0o600)
  } catch (err) {
    log.warn(`failed to chmod 0600: ${filePath} (${String(err)})`)
  }
}

/**
 * 설정 파일을 0600 으로, **원자적으로** 쓴다.
 *
 * M-2: 기존 구현은 대상 파일에 직접 writeFileSync 했다. 쓰기 도중 크래시하면
 * 사용자의 설정 파일이 잘린 채 남는다. temp 에 완성한 뒤 rename 으로 교체하면
 * 파일은 항상 "이전 내용" 아니면 "새 내용" 둘 중 하나다.
 *
 * 권한도 rename 전에 temp 에 적용한다 — 대상 경로에 0644 로 잠깐 존재하는
 * 창(window)을 없애기 위함.
 *
 * 교체 직전 원본을 `.bak` 으로 남긴다. throw 로 막지 못한 경우까지 대비한 마지막 그물.
 */
function writeSecureFile(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true })

  if (existsSync(filePath)) {
    try {
      copyFileSync(filePath, `${filePath}.bak`)
      restrictToOwner(`${filePath}.bak`)
    } catch (err) {
      // 백업 실패가 등록 자체를 막을 이유는 없다. 다만 조용히 넘기지는 않는다.
      log.warn(`failed to back up before write: ${filePath} (${String(err)})`)
    }
  }

  // rename 은 같은 파일시스템 안에서만 원자적이므로 temp 를 같은 디렉터리에 만든다.
  const tmpPath = `${filePath}.${process.pid}.tmp`
  try {
    writeFileSync(tmpPath, contents, 'utf-8')
    restrictToOwner(tmpPath)
    renameSync(tmpPath, filePath)
  } catch (err) {
    try {
      rmSync(tmpPath, { force: true })
    } catch {
      // temp 정리 실패는 무시 — 원본은 이미 보존돼 있다
    }
    throw err
  }
}

function writeConfig(configPath: string, config: ConfigShape): void {
  writeSecureFile(configPath, JSON.stringify(config, null, 2))
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

  /**
   * 보안-H2: MCP 인증 토큰을 재발급하고, 이미 등록된 클라이언트 설정을 새 토큰으로 갱신한다.
   *
   * 토큰이 유출됐다고 판단될 때 사용자가 스스로 무효화할 수 있는 유일한 경로다.
   * (그 전까지 rotateMcpToken() 은 구현·테스트만 있고 호출부가 없는 dead code 였다.)
   *
   * 순서가 중요하다 — 먼저 회전해 구 토큰을 즉시 무효화하고, 그 다음 등록 클라이언트를
   * 새 토큰으로 다시 쓴다. 반대로 하면 갱신 도중 구 토큰이 계속 유효한 창이 생긴다.
   *
   * ⚠️ 이미 떠 있는 MCP 서버 프로세스는 spawn 시점의 env 에 구 토큰을 들고 있으므로
   * 클라이언트를 재시작하기 전까지 401 을 받는다. 호출 측(UI)이 이를 안내해야 한다.
   *
   * 개별 클라이언트 갱신 실패는 전체를 중단시키지 않되 삼키지도 않는다 — failed 로 보고한다.
   */
  rotateToken(): McpRotateResult {
    const before = this.getStatus()
    const targets = (Object.keys(before) as McpClientId[]).filter(
      (c) => before[c].supported && before[c].registered
    )

    rotateMcpToken()
    log.info(`token rotated; re-registering ${targets.length} client(s)`)

    const reRegistered: McpClientId[] = []
    const failed: { client: McpClientId; error: string }[] = []
    for (const client of targets) {
      try {
        this.register(client)
        reRegistered.push(client)
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        log.warn(`re-register failed after rotation: ${client} (${error})`)
        failed.push({ client, error })
      }
    }

    return { status: this.getStatus(), reRegistered, failed }
  },

  register(client: McpClientId): McpClientStatus {
    if (!isClientSupported(client)) {
      throw new Error(`${client}는 이 OS에서 지원되지 않습니다`)
    }
    const configPath = getConfigPath(client)

    if (getConfigFormat(client) === 'toml') {
      // 기존 config.toml 의 사용자 설정(주석·포맷)을 보존하며 rally 블록만 교체.
      // M-2: 읽기 실패를 '' 로 흡수하면 사용자의 config.toml 을 rally 블록만 남기고 날린다.
      const current = readTextForWrite(configPath)
      const next = upsertCodexEntry(current, SERVER_KEY, toEntry(buildServerConfig()))
      writeSecureFile(configPath, next)
      return inspectStatus(client)
    }

    // M-2: 파싱 실패를 {} 로 흡수하면 사용자의 프로젝트 이력·다른 MCP 서버 설정이 전부 사라진다.
    const config = readConfigForWrite(configPath)
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
      const current = readTextForWrite(configPath)
      const next = removeCodexEntry(current, SERVER_KEY)
      if (next !== current) writeSecureFile(configPath, next)
      return inspectStatus(client)
    }

    const config = readConfigForWrite(configPath)
    if (config.mcpServers && SERVER_KEY in config.mcpServers) {
      delete config.mcpServers[SERVER_KEY]
      writeConfig(configPath, config)
    }
    return inspectStatus(client)
  }
}
