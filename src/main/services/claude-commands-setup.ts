import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'

function getSourceCommandsDir(): string {
  return is.dev
    ? join(process.cwd(), '.claude', 'commands')
    : join(process.resourcesPath, '.claude', 'commands')
}

function getSourceCommandFiles(): { name: string; content: string }[] {
  const dir = getSourceCommandsDir()
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
  if (existsSync(mcpPath)) {
    try {
      config = JSON.parse(readFileSync(mcpPath, 'utf-8'))
    } catch {
      writeFileSync(mcpPath + '.bak', readFileSync(mcpPath, 'utf-8'), 'utf-8')
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

  writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function ensureClaudeCommands(workspacePath: string): void {
  if (!workspacePath || !existsSync(workspacePath)) return

  // commands 복사
  const commandsDir = join(workspacePath, '.claude', 'commands')
  const commands = getSourceCommandFiles()
  if (commands.length > 0) {
    mkdirSync(commandsDir, { recursive: true })
    for (const cmd of commands) {
      writeFileSync(join(commandsDir, cmd.name), cmd.content, 'utf-8')
    }
  }

  // MCP 서버 설정
  ensureMcpSettings(workspacePath)
}
