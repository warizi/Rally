import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Notification } from 'electron'
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
    new Notification({
      title: '새로운 업데이트가 준비되었습니다',
      body: `Rally ${info.version} 버전이 다운로드되었습니다. 앱 종료 시 자동으로 설치됩니다.`
    }).show()
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
  })

  autoUpdater.checkForUpdates()
}
