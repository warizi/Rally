import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { appSettingsRepository } from '../repositories/app-settings'

export function registerAppSettingsHandlers(): void {
  ipcMain.handle(
    'settings:get',
    (_: IpcMainInvokeEvent, key: string): IpcResponse =>
      handle(() => appSettingsRepository.get(key))
  )

  ipcMain.handle(
    'settings:set',
    (_: IpcMainInvokeEvent, key: string, value: string): IpcResponse =>
      handle(() => appSettingsRepository.set(key, value))
  )
}
