import type { IpcResponse } from './common'

export interface OnboardingSampleResult {
  workspaceId: string
  path: string
}

export interface OnboardingAPI {
  createSampleWorkspace: () => Promise<IpcResponse<OnboardingSampleResult>>
}
