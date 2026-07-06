import { ipcMain } from 'electron'
import { validateIpc, nonEmptyStringSchema } from '../lib/ipc-validate'
import { z } from 'zod'
import { appSettingsRepository } from '../repositories/app-settings'
import { applyTitleBarOverlayTheme } from '../lib/titlebar-overlay'

export function registerAppSettingsHandlers(): void {
  ipcMain.handle(
    'settings:get',
    validateIpc([nonEmptyStringSchema], (key) => appSettingsRepository.get(key))
  )

  ipcMain.handle(
    'settings:set',
    validateIpc([nonEmptyStringSchema, z.string().max(1_000_000)] as const, (key, value) => {
      appSettingsRepository.set(key, value)
      // win32 WCO 캡션 버튼 색을 앱 테마와 동기화 (다른 플랫폼은 no-op)
      if (key === 'theme') applyTitleBarOverlayTheme(value)
    })
  )
}
