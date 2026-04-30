import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'

function getSourceCommandsDir(): string {
  return is.dev
    ? join(process.cwd(), '.claude', 'commands')
    : join(process.resourcesPath, '.claude', 'commands')
}

function getSourceSkillsDir(): string {
  return is.dev
    ? join(process.cwd(), '.claude', 'skills')
    : join(process.resourcesPath, '.claude', 'skills')
}

function getMdFiles(dir: string): { name: string; content: string }[] {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((f) => ({
    name: f,
    content: readFileSync(join(dir, f), 'utf-8')
  }))
}

function getMcpServerPath(): string {
  return is.dev
    ? join(process.cwd(), 'dist-mcp', 'index.js')
    : join(process.resourcesPath, 'dist-mcp', 'index.js')
}

function ensureMcpSettings(workspacePath: string): void {
  const mcpPath = join(workspacePath, '.mcp.json')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let config: Record<string, any> = {}
  let raw: string | null = null

  if (existsSync(mcpPath)) {
    try {
      raw = readFileSync(mcpPath, 'utf-8')
    } catch (err) {
      // 권한(EPERM) 등으로 읽을 수 없으면 이 워크스페이스는 건너뜀
      console.warn(`[ensureMcpSettings] cannot read ${mcpPath}:`, err)
      return
    }

    try {
      config = JSON.parse(raw)
    } catch {
      // 깨진 JSON: 백업은 best-effort
      try {
        writeFileSync(mcpPath + '.bak', raw, 'utf-8')
      } catch (err) {
        console.warn(`[ensureMcpSettings] failed to write backup:`, err)
      }
      config = {}
    }
  }

  if (!config.mcpServers) {
    config.mcpServers = {}
  }

  config.mcpServers.rally = {
    command: 'node',
    args: [getMcpServerPath()]
  }

  try {
    writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (err) {
    console.warn(`[ensureMcpSettings] cannot write ${mcpPath}:`, err)
  }
}

export function ensureClaudeCommands(workspacePath: string): void {
  if (!workspacePath || !existsSync(workspacePath)) return

  try {
    // commands 복사
    const commandsDir = join(workspacePath, '.claude', 'commands')
    const commands = getMdFiles(getSourceCommandsDir())
    if (commands.length > 0) {
      mkdirSync(commandsDir, { recursive: true })
      for (const cmd of commands) {
        writeFileSync(join(commandsDir, cmd.name), cmd.content, 'utf-8')
      }
    }

    // skills 복사
    const skillsDir = join(workspacePath, '.claude', 'skills')
    const skills = getMdFiles(getSourceSkillsDir())
    if (skills.length > 0) {
      mkdirSync(skillsDir, { recursive: true })
      for (const skill of skills) {
        writeFileSync(join(skillsDir, skill.name), skill.content, 'utf-8')
      }
    }
  } catch (err) {
    console.warn(`[ensureClaudeCommands] failed for ${workspacePath}:`, err)
  }

  // MCP 서버 설정 (내부에서 자체 에러 처리)
  ensureMcpSettings(workspacePath)
}
