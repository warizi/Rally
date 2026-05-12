import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import {
  noteStyleTemplateService,
  type CreateNoteStyleTemplateInput
} from '../services/note-style-template'

export function registerNoteStyleTemplateHandlers(): void {
  ipcMain.handle(
    'noteStyleTemplate:list',
    (): IpcResponse => handle(() => noteStyleTemplateService.list())
  )

  ipcMain.handle(
    'noteStyleTemplate:create',
    (_: IpcMainInvokeEvent, input: CreateNoteStyleTemplateInput): IpcResponse =>
      handle(() => noteStyleTemplateService.create(input))
  )

  ipcMain.handle(
    'noteStyleTemplate:remove',
    (_: IpcMainInvokeEvent, id: string): IpcResponse =>
      handle(() => noteStyleTemplateService.remove(id))
  )
}
