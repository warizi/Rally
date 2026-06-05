import { ipcMain } from 'electron'
import { validateIpc, nonEmptyStringSchema } from '../lib/ipc-validate'
import { z } from 'zod'
import { appSettingsRepository } from '../repositories/app-settings'

export function registerAppSettingsHandlers(): void {
  ipcMain.handle(
    'settings:get',
    validateIpc([nonEmptyStringSchema], (key) => appSettingsRepository.get(key))
  )

  ipcMain.handle(
    'settings:set',
    validateIpc([nonEmptyStringSchema, z.string().max(1_000_000)] as const, (key, value) =>
      appSettingsRepository.set(key, value)
    )
  )
}
