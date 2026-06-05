import type { IpcResponse } from './common'

export interface SettingsAPI {
  get: (key: string) => Promise<IpcResponse<string | null>>
  set: (key: string, value: string) => Promise<IpcResponse<void>>
}
