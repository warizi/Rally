import { ipcRenderer } from 'electron'
import type { McpActivityPayload } from '../types/mcp-activity'

export const mcpActivityApi = {
  onActivity: (callback: (payload: McpActivityPayload) => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: McpActivityPayload): void =>
      callback(payload)
    ipcRenderer.on('mcp:activity', handler)
    return () => ipcRenderer.removeListener('mcp:activity', handler)
  }
}
