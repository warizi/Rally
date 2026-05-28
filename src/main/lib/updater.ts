import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Notification } from 'electron'
import { is } from '@electron-toolkit/utils'
import { scoped } from './logger'

const log = scoped('updater')

export function setupAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
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
    log.error('Auto-updater error:', err)
  })

  autoUpdater.checkForUpdates()
}
