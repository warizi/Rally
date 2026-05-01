import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { templateService } from '../services/template'
import type { TemplateType } from '../repositories/template'

export function registerTemplateHandlers(): void {
  ipcMain.handle(
    'template:list',
    (_: IpcMainInvokeEvent, workspaceId: string, type: TemplateType): IpcResponse =>
      handle(() => templateService.list(workspaceId, type))
  )

  ipcMain.handle(
    'template:create',
    (
      _: IpcMainInvokeEvent,
      input: { workspaceId: string; title: string; type: TemplateType; jsonData: string }
    ): IpcResponse => handle(() => templateService.create(input))
  )

  ipcMain.handle(
    'template:delete',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => templateService.delete(id))
  )
}
