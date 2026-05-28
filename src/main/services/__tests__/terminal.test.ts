/**
 * terminalService 단위 테스트.
 *
 * Public API: isTmuxAvailable / create / write / resize / destroy / destroyAll / destroyAllSessions.
 *
 * initTmux() 는 모듈 import 시점에 1회 실행되어 tmuxBin 을 결정. 본 테스트에서는
 * fs/execSync 를 mock 해 모듈 import 전에 tmux 사용 불가(=직접 PTY) 환경을 만든다.
 * 그 외 pty.spawn / Electron BrowserWindow 도 모두 mock.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { ptySpawnMock, ptyKillMock, ptyWriteMock, ptyResizeMock, ptyOnDataMock, ptyOnExitMock } =
  vi.hoisted(() => ({
    ptySpawnMock: vi.fn(),
    ptyKillMock: vi.fn(),
    ptyWriteMock: vi.fn(),
    ptyResizeMock: vi.fn(),
    ptyOnDataMock: vi.fn(),
    ptyOnExitMock: vi.fn()
  }))

vi.mock('node-pty', () => ({
  spawn: ptySpawnMock
}))

// fs / execSync 를 mock 해 tmux 가 발견되지 않게 만듦 → terminalService 는 직접 PTY 사용
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  accessSync: vi.fn(() => undefined),
  constants: { R_OK: 4, X_OK: 1 }
}))
vi.mock('child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('tmux not available')
  })
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/dev/null/app'
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

import { terminalService } from '../terminal'

beforeEach(() => {
  vi.clearAllMocks()
  // pty.spawn 기본 mock: write/resize/kill 가능한 가짜 IPty
  ptySpawnMock.mockImplementation(() => ({
    write: ptyWriteMock,
    resize: ptyResizeMock,
    kill: ptyKillMock,
    onData: ptyOnDataMock,
    onExit: ptyOnExitMock
  }))
})

afterEach(() => {
  // 다음 테스트로 PTY 세션이 누수되지 않게
  terminalService.destroyAllSessions()
})

describe('terminalService.isTmuxAvailable', () => {
  it('initTmux 가 tmux 를 못 찾으면 false', () => {
    // mock 환경에서 fs.existsSync = false + execSync = throw 라서 tmuxBin = null
    expect(terminalService.isTmuxAvailable()).toBe(false)
  })
})

describe('terminalService.create + write / resize / destroy', () => {
  it('create → pty.spawn 호출 + onData/onExit 핸들러 등록', () => {
    terminalService.create('term-aabbcc1', 'ws-aabbcc1', '/tmp', undefined, 80, 24)

    expect(ptySpawnMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ cols: 80, rows: 24, cwd: '/tmp' })
    )
    expect(ptyOnDataMock).toHaveBeenCalled()
    expect(ptyOnExitMock).toHaveBeenCalled()
  })

  it('write → 활성 세션에만 위임', () => {
    terminalService.create('term-aabbcc1', 'ws-aabbcc1', '/tmp', undefined, 80, 24)

    terminalService.write('term-aabbcc1', 'ls\n')
    expect(ptyWriteMock).toHaveBeenCalledWith('ls\n')
  })

  it('write 시 존재하지 않는 id → no-op (throw X)', () => {
    expect(() => terminalService.write('term-missing', 'x')).not.toThrow()
    expect(ptyWriteMock).not.toHaveBeenCalled()
  })

  it('resize → pty.resize 위임', () => {
    terminalService.create('term-aabbcc1', 'ws-aabbcc1', '/tmp', undefined, 80, 24)

    terminalService.resize('term-aabbcc1', 100, 30)
    expect(ptyResizeMock).toHaveBeenCalledWith(100, 30)
  })

  it('destroy → pty.kill + 세션 제거 (이후 write 는 no-op)', () => {
    terminalService.create('term-aabbcc1', 'ws-aabbcc1', '/tmp', undefined, 80, 24)
    terminalService.destroy('term-aabbcc1')

    expect(ptyKillMock).toHaveBeenCalled()

    // 세션 제거 후 write 는 아무 효과 없음
    terminalService.write('term-aabbcc1', 'after-destroy')
    expect(ptyWriteMock).not.toHaveBeenCalled()
  })

  it('destroy 시 존재하지 않는 id → no-op', () => {
    expect(() => terminalService.destroy('term-missing')).not.toThrow()
    expect(ptyKillMock).not.toHaveBeenCalled()
  })
})

describe('terminalService.destroyAll / destroyAllSessions', () => {
  it('destroyAll(workspaceId) → 해당 ws 의 세션만 kill, 다른 ws 는 유지', () => {
    terminalService.create('term-a0000001', 'ws-aaaaaa1', '/tmp', undefined, 80, 24)
    terminalService.create('term-b0000001', 'ws-bbbbbb1', '/tmp', undefined, 80, 24)

    terminalService.destroyAll('ws-aaaaaa1')

    expect(ptyKillMock).toHaveBeenCalledTimes(1)
    // 다른 ws 의 세션은 살아있어 write 가능
    terminalService.write('term-b0000001', 'still alive')
    expect(ptyWriteMock).toHaveBeenCalledWith('still alive')
  })

  it('destroyAllSessions → kill 호출 없이 모든 세션 clear (V8 teardown 안전)', () => {
    terminalService.create('term-c0000001', 'ws-cccccc1', '/tmp', undefined, 80, 24)

    terminalService.destroyAllSessions()
    expect(ptyKillMock).not.toHaveBeenCalled()
    // 세션 clear 후 write 무효
    terminalService.write('term-c0000001', 'x')
    expect(ptyWriteMock).not.toHaveBeenCalled()
  })
})
