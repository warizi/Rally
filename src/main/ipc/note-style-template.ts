import { ipcMain } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import { noteStyleTemplateCreateSchema } from './schemas'
import { noteStyleTemplateService } from '../services/note-style-template'

export function registerNoteStyleTemplateHandlers(): void {
  ipcMain.handle(
    'noteStyleTemplate:list',
    validateNoArgs((): IpcResponse => handle(() => noteStyleTemplateService.list()))
  )

  ipcMain.handle(
    'noteStyleTemplate:create',
    validateIpc([noteStyleTemplateCreateSchema], (input) => noteStyleTemplateService.create(input))
  )

  ipcMain.handle(
    'noteStyleTemplate:remove',
    validateIpc([idSchema], (id) => noteStyleTemplateService.remove(id))
  )
}
