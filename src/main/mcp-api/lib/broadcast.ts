import { BrowserWindow } from 'electron'

export function broadcastChanged(channel: string, wsId: string, paths: string[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, wsId, paths)
  })
}
