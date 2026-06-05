import { ipcMain } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { validateNoArgs } from '../lib/ipc-validate'
import { onboardingSampleService } from '../services/onboarding-sample'

export function registerOnboardingHandlers(): void {
  ipcMain.handle(
    'onboarding:createSampleWorkspace',
    validateNoArgs((): IpcResponse => handle(() => onboardingSampleService.createSampleWorkspace()))
  )
}
