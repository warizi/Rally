import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { validateIpc, validateNoArgs } from '../lib/ipc-validate'
import { mcpClientIdSchema } from './schemas'
import {
  mcpClientConfigService,
  type McpClientStatus,
  type McpClientStatusMap
} from '../services/mcp-client-config'

export interface CommandFile {
  name: string
  description: string
  content: string
}

function readMdFiles(dir: string): CommandFile[] {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((f) => {
    const content = readFileSync(join(dir, f), 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())
    const description = lines.length > 1 ? lines[1].trim() : ''
    return {
      name: f.replace('.md', ''),
      description,
      content
    }
  })
}

export function registerAppInfoHandlers(): void {
  ipcMain.handle(
    'appInfo:getVersion',
    validateNoArgs((): IpcResponse<string> => handle(() => app.getVersion()))
  )

  ipcMain.handle(
    'appInfo:getMcpServerPath',
    validateNoArgs((): IpcResponse<string> =>
      handle(() => {
        if (is.dev) {
          return join(process.cwd(), 'dist-mcp', 'index.js')
        }
        return join(process.resourcesPath, 'dist-mcp', 'index.js')
      })
    )
  )

  ipcMain.handle(
    'appInfo:getCommandFiles',
    validateNoArgs((): IpcResponse<CommandFile[]> =>
      handle(() => {
        const commandsDir = is.dev
          ? join(process.cwd(), '.claude', 'commands')
          : join(process.resourcesPath, '.claude', 'commands')
        return readMdFiles(commandsDir)
      })
    )
  )

  ipcMain.handle(
    'appInfo:getSkillFiles',
    validateNoArgs((): IpcResponse<CommandFile[]> =>
      handle(() => {
        const skillsDir = is.dev
          ? join(process.cwd(), '.claude', 'skills')
          : join(process.resourcesPath, '.claude', 'skills')
        return readMdFiles(skillsDir)
      })
    )
  )

  ipcMain.handle(
    'mcpClient:getStatus',
    validateNoArgs(
      (): IpcResponse<{
        status: McpClientStatusMap
        serverKey: string
        serverConfig: Record<string, unknown>
      }> =>
        handle(() => ({
          status: mcpClientConfigService.getStatus(),
          serverKey: mcpClientConfigService.getServerKey(),
          serverConfig: mcpClientConfigService.getServerConfig()
        }))
    )
  )

  ipcMain.handle(
    'mcpClient:register',
    validateIpc(
      [mcpClientIdSchema],
      (client): McpClientStatus => mcpClientConfigService.register(client)
    )
  )

  ipcMain.handle(
    'mcpClient:unregister',
    validateIpc(
      [mcpClientIdSchema],
      (client): McpClientStatus => mcpClientConfigService.unregister(client)
    )
  )
}
