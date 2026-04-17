import * as pty from 'node-pty'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { app, BrowserWindow } from 'electron'

interface SessionEntry {
  pty: pty.IPty
  cwd: string
  workspaceId: string
  useTmux: boolean
}

const sessions = new Map<string, SessionEntry>()

// 앱 기동 시 1회 결정: null = tmux 사용 불가 → 직접 PTY 폴백
let tmuxBin: string | null = null

function getTmuxBinaryPath(): string {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'win32') return ''

  const subdir = platform === 'darwin' ? `mac-${arch}` : `linux-${arch}`

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', subdir, 'tmux')
  }
  // 개발 환경: 프로젝트 루트 기준
  return path.join(app.getAppPath(), 'resources', 'bin', subdir, 'tmux')
}

function initTmux(): void {
  if (process.platform === 'win32') {
    tmuxBin = null
    return
  }

  // 1순위: 번들 바이너리
  const bundled = getTmuxBinaryPath()
  if (bundled && fs.existsSync(bundled)) {
    try {
      fs.accessSync(bundled, fs.constants.X_OK)
      execSync(`"${bundled}" -V 2>/dev/null`, { stdio: 'ignore' })
      tmuxBin = bundled
      return
    } catch {
      // 번들 바이너리 실행 실패 → 다음 단계
    }
  }

  // 2순위: login shell 경유 — 패키징 앱 PATH가 제한적이라 Homebrew 경로를 못 찾는 문제 해결
  const loginShell = process.env.SHELL || '/bin/zsh'
  try {
    const found = execSync(`"${loginShell}" -l -c 'which tmux' 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 3000
    }).trim()
    if (found && fs.existsSync(found)) {
      execSync(`"${found}" -V 2>/dev/null`, { stdio: 'ignore' })
      tmuxBin = found
      return
    }
  } catch {
    // login shell 실패 → 다음 단계
  }

  // 3순위: 알려진 경로 직접 탐색 (Homebrew, 시스템)
  const knownPaths = [
    '/opt/homebrew/bin/tmux', // macOS ARM64 Homebrew
    '/usr/local/bin/tmux',    // macOS x64 Homebrew
    '/usr/bin/tmux'
  ]
  for (const p of knownPaths) {
    if (fs.existsSync(p)) {
      try {
        execSync(`"${p}" -V 2>/dev/null`, { stdio: 'ignore' })
        tmuxBin = p
        return
      } catch {
        // 실행 불가 → 다음
      }
    }
  }

  // 폴백: 직접 PTY 모드
  tmuxBin = null
}

// 모듈 로드 시 1회 실행
initTmux()

function getDefaultShell(): string {
  return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')
}

// 패키징 환경에서 LANG/LC_ALL 미설정 시 한글 깨짐 방지
function buildPtyEnv(): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) }
  if (!env.LANG) env.LANG = 'en_US.UTF-8'
  if (!env.LC_ALL) env.LC_ALL = 'en_US.UTF-8'
  if (!env.LC_CTYPE) env.LC_CTYPE = 'en_US.UTF-8'
  return env
}

function createWithTmux(
  id: string,
  workspaceId: string,
  cwd: string,
  cols: number,
  rows: number
): void {
  const sessionName = `rally-${id}`

  const p = pty.spawn(
    tmuxBin!,
    ['-L', 'rally', 'new-session', '-A', '-s', sessionName, '-c', cwd, '-x', String(cols), '-y', String(rows)],
    {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: buildPtyEnv()
    }
  )

  sessions.set(id, { pty: p, cwd, workspaceId, useTmux: true })

  p.onData((data: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('terminal:data', { id, data })
    })
  })

  p.onExit(({ exitCode }) => {
    sessions.delete(id)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('terminal:exit', { id, exitCode })
    })
  })
}

function createDirect(
  id: string,
  workspaceId: string,
  cwd: string,
  shell: string | undefined,
  cols: number,
  rows: number
): void {
  const resolvedShell = shell || getDefaultShell()

  const p = pty.spawn(resolvedShell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: buildPtyEnv()
  })

  sessions.set(id, { pty: p, cwd, workspaceId, useTmux: false })

  p.onData((data: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('terminal:data', { id, data })
    })
  })

  p.onExit(({ exitCode }) => {
    sessions.delete(id)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('terminal:exit', { id, exitCode })
    })
  })
}

export const terminalService = {
  isTmuxAvailable(): boolean {
    return tmuxBin !== null
  },

  // id는 IPC 핸들러에서 생성한 nanoid — PTY와 DB가 동일 ID 공유
  create(
    id: string,
    workspaceId: string,
    cwd: string,
    shell: string | undefined,
    cols: number,
    rows: number
  ): void {
    fs.accessSync(cwd, fs.constants.R_OK)

    if (tmuxBin) {
      createWithTmux(id, workspaceId, cwd, cols, rows)
    } else {
      createDirect(id, workspaceId, cwd, shell, cols, rows)
    }
  },

  write(id: string, data: string): void {
    sessions.get(id)?.pty.write(data)
  },

  resize(id: string, cols: number, rows: number): void {
    sessions.get(id)?.pty.resize(cols, rows)
  },

  // 탭 명시적 닫기: PTY kill + tmux 세션 제거
  destroy(id: string): void {
    const entry = sessions.get(id)
    if (!entry) return

    entry.pty.kill()
    sessions.delete(id)

    if (entry.useTmux && tmuxBin) {
      try {
        execSync(`"${tmuxBin}" -L rally kill-session -t rally-${id}`, { stdio: 'ignore' })
      } catch {
        // 세션이 이미 없으면 무시
      }
    }
  },

  // 워크스페이스 전환: PTY 클라이언트만 끊기, tmux 세션 유지
  destroyAll(workspaceId: string): void {
    for (const [id, entry] of sessions) {
      if (entry.workspaceId === workspaceId) {
        entry.pty.kill()
        sessions.delete(id)
        // tmux kill-session 호출하지 않음 → 세션 생존
      }
    }
  },

  // 앱 종료: pty.kill() 호출하지 않음
  // V8 teardown 중 node-pty onExit 콜백이 JS 환경으로 역호출하면 SIGABRT 크래시 발생.
  // OS가 자식 프로세스를 정리하며, tmux 클라이언트는 SIGHUP 수신 시 detach → 세션 생존.
  destroyAllSessions(): void {
    sessions.clear()
  }
}
