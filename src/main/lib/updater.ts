import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

export function setupAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.send('update-downloaded', info.version)
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
  })

  autoUpdater.checkForUpdatesAndNotify()
}
