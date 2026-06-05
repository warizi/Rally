import { ipcMain, dialog } from 'electron'
import { workspaceService } from '../services/workspace'
import { handle } from '../lib/handle'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import { workspaceNameSchema, workspacePathSchema, workspaceUpdateSchema } from './schemas'
import { workspaceWatcher } from '../services/workspace-watcher'
import { ensureClaudeCommands } from '../services/claude-commands-setup'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(
    'workspace:getAll',
    validateNoArgs(() => handle(() => workspaceService.getAll()))
  )

  ipcMain.handle(
    'workspace:getById',
    validateIpc([idSchema], (id) => workspaceService.getById(id))
  )

  // 보안-1 Phase 3: name / path 검증 (path traversal 차단, 길이 제한).
  ipcMain.handle(
    'workspace:create',
    validateIpc([workspaceNameSchema, workspacePathSchema] as const, (name, path) => {
      const ws = workspaceService.create(name, path)
      ensureClaudeCommands(ws.path)
      return ws
    })
  )

  ipcMain.handle(
    'workspace:update',
    validateIpc([idSchema, workspaceUpdateSchema] as const, (id, data) => {
      const updated = workspaceService.update(id, data)
      // path가 변경된 경우 watcher 재시작 (fire-and-forget)
      // ensureWatching이 activeWorkspacePath와 비교하므로 path 미변경 시 no-op
      if (data.path !== undefined && updated) {
        void workspaceWatcher.ensureWatching(id, updated.path)
      }
      return updated
    })
  )

  ipcMain.handle(
    'workspace:delete',
    validateIpc([idSchema], (id) => workspaceService.delete(id))
  )

  ipcMain.handle(
    'workspace:activate',
    validateIpc([idSchema], (id) => {
      const ws = workspaceService.getById(id)
      ensureClaudeCommands(ws.path)
      void workspaceWatcher.ensureWatching(ws.id, ws.path)
      return ws
    })
  )

  ipcMain.handle(
    'workspace:selectDirectory',
    validateNoArgs(async (): Promise<string | null> => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
      })
      return canceled ? null : filePaths[0]
    })
  )
}
