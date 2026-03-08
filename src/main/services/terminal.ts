import * as pty from 'node-pty'
import * as fs from 'fs'
import { BrowserWindow } from 'electron'

let currentPty: pty.IPty | null = null
let currentCwd: string | null = null

function getDefaultShell(): string {
  return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')
}

export const terminalService = {
  create(cwd: string, cols: number, rows: number): void {
    fs.accessSync(cwd, fs.constants.R_OK)

    // 같은 cwd로 이미 pty가 있으면 resize만 하고 재사용
    if (currentPty && currentCwd === cwd) {
      currentPty.resize(cols, rows)
      return
    }

    // 다른 cwd(워크스페이스 전환)면 기존 pty kill 후 새로 생성
    if (currentPty) {
      currentPty.kill()
      currentPty = null
      currentCwd = null
    }

    const shell = getDefaultShell()
    currentPty = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>
    })
    currentCwd = cwd

    currentPty.onData((data: string) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('terminal:data', { data })
      })
    })

    currentPty.onExit(({ exitCode }) => {
      currentPty = null
      currentCwd = null
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('terminal:exit', { exitCode })
      })
    })
  },

  write(data: string): void {
    currentPty?.write(data)
  },

  resize(cols: number, rows: number): void {
    currentPty?.resize(cols, rows)
  },

  destroy(): void {
    if (currentPty) {
      currentPty.kill()
      currentPty = null
      currentCwd = null
    }
  }
}
