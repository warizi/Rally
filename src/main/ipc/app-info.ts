import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import {
  mcpClientConfigService,
  type McpClientId,
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
  ipcMain.handle('appInfo:getVersion', (): IpcResponse<string> => {
    return handle(() => app.getVersion())
  })

  ipcMain.handle('appInfo:getMcpServerPath', (): IpcResponse<string> => {
    return handle(() => {
      if (is.dev) {
        return join(process.cwd(), 'dist-mcp', 'index.js')
      }
      return join(process.resourcesPath, 'dist-mcp', 'index.js')
    })
  })

  ipcMain.handle('appInfo:getCommandFiles', (): IpcResponse<CommandFile[]> => {
    return handle(() => {
      const commandsDir = is.dev
        ? join(process.cwd(), '.claude', 'commands')
        : join(process.resourcesPath, '.claude', 'commands')
      return readMdFiles(commandsDir)
    })
  })

  ipcMain.handle('appInfo:getSkillFiles', (): IpcResponse<CommandFile[]> => {
    return handle(() => {
      const skillsDir = is.dev
        ? join(process.cwd(), '.claude', 'skills')
        : join(process.resourcesPath, '.claude', 'skills')
      return readMdFiles(skillsDir)
    })
  })

  ipcMain.handle(
    'mcpClient:getStatus',
    (): IpcResponse<{
      status: McpClientStatusMap
      serverKey: string
      serverConfig: Record<string, unknown>
    }> => {
      return handle(() => ({
        status: mcpClientConfigService.getStatus(),
        serverKey: mcpClientConfigService.getServerKey(),
        serverConfig: mcpClientConfigService.getServerConfig()
      }))
    }
  )

  ipcMain.handle(
    'mcpClient:register',
    (_evt, client: McpClientId): IpcResponse<McpClientStatus> => {
      return handle(() => mcpClientConfigService.register(client))
    }
  )

  ipcMain.handle(
    'mcpClient:unregister',
    (_evt, client: McpClientId): IpcResponse<McpClientStatus> => {
      return handle(() => mcpClientConfigService.unregister(client))
    }
  )
}
