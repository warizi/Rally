import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import {
  skillService,
  type CreateCustomSkillInput,
  type UpdateCustomSkillInput
} from '../services/skill'

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', (): IpcResponse => handle(() => skillService.list()))

  ipcMain.handle(
    'skill:get',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.get(id))
  )

  ipcMain.handle(
    'skill:create',
    (_: IpcMainInvokeEvent, input: CreateCustomSkillInput): IpcResponse =>
      handle(() => skillService.create(input))
  )

  ipcMain.handle(
    'skill:update',
    (_: IpcMainInvokeEvent, id: string, input: UpdateCustomSkillInput): IpcResponse =>
      handle(() => skillService.update(id, input))
  )

  ipcMain.handle(
    'skill:remove',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.remove(id))
  )
}
