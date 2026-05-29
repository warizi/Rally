/**
 * setupAutoUpdater 단위 테스트.
 *
 * is.dev 분기 + 이벤트 핸들러 등록 (update-available / update-downloaded / error) +
 * checkForUpdates 호출 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { autoUpdaterMock, getFocusedWindowMock, NotificationMock, isObj } = vi.hoisted(() => ({
  autoUpdaterMock: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn()
  },
  getFocusedWindowMock: vi.fn(),
  NotificationMock: vi.fn(function (this: { show: ReturnType<typeof vi.fn> }) {
    this.show = vi.fn()
  }),
  isObj: { dev: false }
}))

vi.mock('electron-updater', () => ({ autoUpdater: autoUpdaterMock }))
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: getFocusedWindowMock },
  Notification: NotificationMock
}))
vi.mock('@electron-toolkit/utils', () => ({ is: isObj }))
vi.mock('../logger', () => ({
  scoped: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { setupAutoUpdater } from '../updater'

beforeEach(() => {
  vi.clearAllMocks()
  autoUpdaterMock.autoDownload = false
  autoUpdaterMock.autoInstallOnAppQuit = false
  isObj.dev = false
})

describe('setupAutoUpdater', () => {
  it('is.dev 면 early return (autoUpdater 미초기화)', () => {
    isObj.dev = true
    setupAutoUpdater()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(autoUpdaterMock.on).not.toHaveBeenCalled()
  })

  it('production → autoDownload + autoInstallOnAppQuit 설정 + 3개 이벤트 + checkForUpdates', () => {
    isObj.dev = false
    setupAutoUpdater()

    expect(autoUpdaterMock.autoDownload).toBe(true)
    expect(autoUpdaterMock.autoInstallOnAppQuit).toBe(true)

    // 3개 이벤트 등록
    const events = autoUpdaterMock.on.mock.calls.map((c) => c[0])
    expect(events).toContain('update-available')
    expect(events).toContain('update-downloaded')
    expect(events).toContain('error')

    expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalled()
  })

  it('update-downloaded 핸들러 → 포커스 윈도우에 send + Notification 표시', () => {
    isObj.dev = false
    const sendMock = vi.fn()
    getFocusedWindowMock.mockReturnValue({ webContents: { send: sendMock } })

    setupAutoUpdater()
    const downloadedHandler = autoUpdaterMock.on.mock.calls.find(
      (c) => c[0] === 'update-downloaded'
    )?.[1] as ((info: { version: string }) => void) | undefined
    expect(downloadedHandler).toBeDefined()

    downloadedHandler!({ version: '1.15.0' })
    expect(sendMock).toHaveBeenCalledWith('update-downloaded', '1.15.0')
    expect(NotificationMock).toHaveBeenCalled()
  })

  it('update-downloaded → 포커스 윈도우 없으면 send 스킵 (Notification 만)', () => {
    isObj.dev = false
    getFocusedWindowMock.mockReturnValue(null)

    setupAutoUpdater()
    const downloadedHandler = autoUpdaterMock.on.mock.calls.find(
      (c) => c[0] === 'update-downloaded'
    )?.[1] as ((info: { version: string }) => void) | undefined

    expect(() => downloadedHandler!({ version: '1.15.0' })).not.toThrow()
    expect(NotificationMock).toHaveBeenCalled()
  })

  it('error 핸들러 등록 → 로깅만 (throw 없음)', () => {
    isObj.dev = false
    setupAutoUpdater()
    const errHandler = autoUpdaterMock.on.mock.calls.find((c) => c[0] === 'error')?.[1] as
      | ((err: Error) => void)
      | undefined

    expect(() => errHandler!(new Error('boom'))).not.toThrow()
  })
})
