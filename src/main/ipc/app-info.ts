import { app, ipcMain, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { logger } from '../lib/logger'
import { validateIpc, validateNoArgs } from '../lib/ipc-validate'
import { mcpClientIdSchema } from './schemas'
import {
  mcpClientConfigService,
  type McpClientStatus,
  type McpClientStatusMap,
  type McpRotateResult
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
    validateNoArgs(
      (): IpcResponse<string> =>
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
    validateNoArgs(
      (): IpcResponse<CommandFile[]> =>
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
    validateNoArgs(
      (): IpcResponse<CommandFile[]> =>
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

  /**
   * M-5/M-7: 오류 화면에서 "로그 열기". 크래시 리포팅이 없으므로 사용자가 로그를 직접
   * 찾아 첨부할 수 있어야 한다.
   *
   * 경로는 electron-log 가 관리하는 앱 로그 파일에서 가져온다 — 렌더러 입력을 받지 않는다.
   * showItemInFolder 로 파일을 선택된 상태로 띄워, 사용자가 어느 파일인지 헷갈리지 않게 한다.
   */
  ipcMain.handle(
    'appInfo:openLogFolder',
    validateNoArgs(
      (): IpcResponse<string> =>
        handle(() => {
          const logPath = logger.transports.file.getFile().path
          shell.showItemInFolder(logPath)
          return logPath
        })
    )
  )

  // 보안-H2: 토큰 재발급 + 등록된 클라이언트 설정 자동 갱신.
  // 인자 없음 — 렌더러가 토큰 값을 다루지 않도록 main 이 전부 처리한다.
  ipcMain.handle(
    'mcpClient:rotateToken',
    validateNoArgs(
      (): IpcResponse<McpRotateResult> => handle(() => mcpClientConfigService.rotateToken())
    )
  )
}
