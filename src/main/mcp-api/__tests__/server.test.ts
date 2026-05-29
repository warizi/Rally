/**
 * startMcpApiServer / stopMcpApiServer 단위 테스트.
 *
 * Unix 소켓 권한 0600 + cleanup 동작 검증. http.createServer + fs/path/os 를 모두 mock 하여
 * 실제 소켓 생성 없이 호출 시퀀스만 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mkdirSyncMock, unlinkSyncMock, chmodSyncMock, listenMock, closeMock, createServerMock } =
  vi.hoisted(() => ({
    mkdirSyncMock: vi.fn(),
    unlinkSyncMock: vi.fn(),
    chmodSyncMock: vi.fn(),
    listenMock: vi.fn((_path: string, cb: () => void) => {
      cb()
    }),
    closeMock: vi.fn(),
    createServerMock: vi.fn(() => ({
      listen: listenMock,
      close: closeMock
    }))
  }))

vi.mock('http', () => ({
  default: { createServer: createServerMock },
  createServer: createServerMock
}))
vi.mock('fs', () => ({
  default: {
    mkdirSync: mkdirSyncMock,
    unlinkSync: unlinkSyncMock,
    chmodSync: chmodSyncMock
  },
  mkdirSync: mkdirSyncMock,
  unlinkSync: unlinkSyncMock,
  chmodSync: chmodSyncMock
}))
vi.mock('os', () => ({
  default: { homedir: () => '/Users/test' },
  homedir: () => '/Users/test'
}))
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false }
}))
vi.mock('../router', () => ({
  createRouter: vi.fn(() => ({ handle: vi.fn() }))
}))
vi.mock('../routes', () => ({
  registerAllRoutes: vi.fn()
}))
vi.mock('../../lib/logger', () => ({
  scoped: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { startMcpApiServer, stopMcpApiServer } from '../server'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mcp-api/server', () => {
  it('startMcpApiServer (non-win) → 소켓 디렉토리 생성 + 기존 파일 unlink + listen + chmod 0600', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

    try {
      startMcpApiServer()

      // 디렉토리 생성
      expect(mkdirSyncMock).toHaveBeenCalledWith(expect.any(String), { recursive: true })
      // 기존 소켓 unlink (없어도 catch)
      expect(unlinkSyncMock).toHaveBeenCalled()
      // http server 생성 + listen
      expect(createServerMock).toHaveBeenCalled()
      expect(listenMock).toHaveBeenCalled()
      // 소켓 권한 0600
      expect(chmodSyncMock).toHaveBeenCalledWith(expect.any(String), 0o600)
    } finally {
      stopMcpApiServer()
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    }
  })

  it('기존 소켓 파일 unlink 실패해도 throw 없이 진행', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    unlinkSyncMock.mockImplementationOnce(() => {
      throw new Error('ENOENT')
    })

    try {
      expect(() => startMcpApiServer()).not.toThrow()
    } finally {
      stopMcpApiServer()
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    }
  })

  it('stopMcpApiServer → server.close + 소켓 파일 unlink', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

    try {
      startMcpApiServer()
      unlinkSyncMock.mockClear()

      stopMcpApiServer()
      expect(closeMock).toHaveBeenCalled()
      expect(unlinkSyncMock).toHaveBeenCalled()
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    }
  })

  it('stopMcpApiServer 가 시작 전에 호출되어도 throw 없음', () => {
    expect(() => stopMcpApiServer()).not.toThrow()
  })
})
