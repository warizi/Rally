import { ipcRenderer } from 'electron'

export const onboardingApi = {
  createSampleWorkspace: () => ipcRenderer.invoke('onboarding:createSampleWorkspace')
}
