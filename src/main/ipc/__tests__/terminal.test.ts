/**
 * terminal IPC 핸들러 회귀 테스트.
 *
 * 다른 IPC 와 달리:
 * - terminal:create: validateIpc + nanoid 생성 + DB 세션 record 생성 분기 (args.id 유무)
 * - terminal:write/resize: ipcMain.on (fire-and-forget)
 * - terminal:destroy/destroyAll: validateIpc (id 검증)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'newid-aabbcc1')
}))
vi.mock('../../services/terminal', () => ({
  terminalService: {
    create: vi.fn(),
    destroy: vi.fn(),
    destroyAll: vi.fn(),
    write: vi.fn(),
    resize: vi.fn()
  }
}))
vi.mock('../../repositories/terminal-session', () => ({
  terminalSessionRepository: {
    create: vi.fn(),
    saveSnapshot: vi.fn(),
    findActiveByWorkspaceId: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
  }
}))
vi.mock('../../repositories/terminal-layout', () => ({
  terminalLayoutRepository: {
    findByWorkspaceId: vi.fn(),
    upsert: vi.fn()
  }
}))

import { registerTerminalHandlers } from '../terminal'
import { terminalService } from '../../services/terminal'
import { terminalSessionRepository } from '../../repositories/terminal-session'
import { terminalLayoutRepository } from '../../repositories/terminal-layout'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerTerminalHandlers()
})

describe('terminal IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'terminal:create',
      'terminal:destroy',
      'terminal:destroyAll',
      'terminal:write',
      'terminal:resize',
      'terminal:saveSnapshot',
      'terminal:getSessions',
      'terminal:getLayout',
      'terminal:updateSession',
      'terminal:saveLayout',
      'terminal:closeSession'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('terminal:create (id 없음=신규 탭) → nanoid 호출 + service.create + DB session 생성', () => {
    const args = {
      workspaceId: 'ws-aabbcc12',
      cwd: '/tmp',
      cols: 80,
      rows: 24,
      sortOrder: 5
    }
    const result = getHandler<{ success: boolean; data: { id: string } }>('terminal:create')(
      {},
      args
    ) as { success: boolean; data: { id: string } }

    expect(terminalService.create).toHaveBeenCalledWith(
      'newid-aabbcc1',
      'ws-aabbcc12',
      '/tmp',
      undefined,
      80,
      24
    )
    expect(terminalSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'newid-aabbcc1',
        workspaceId: 'ws-aabbcc12',
        cwd: '/tmp',
        rows: 24,
        cols: 80,
        sortOrder: 5,
        isActive: 1
      })
    )
    expect(result.data.id).toBe('newid-aabbcc1')
  })

  it('terminal:create (id 있음=복원) → 기존 id 사용 + DB record 생성 안 함', () => {
    getHandler('terminal:create')({}, {
      id: 'existing12345',
      workspaceId: 'ws-aabbcc12',
      cwd: '/tmp',
      cols: 80,
      rows: 24
    })

    expect(terminalService.create).toHaveBeenCalledWith(
      'existing12345',
      'ws-aabbcc12',
      '/tmp',
      undefined,
      80,
      24
    )
    expect(terminalSessionRepository.create).not.toHaveBeenCalled()
  })

  it('terminal:destroy → 유효한 id 시 service.destroy 호출', () => {
    getHandler('terminal:destroy')({}, 'newid-aabbcc1')
    expect(terminalService.destroy).toHaveBeenCalledWith('newid-aabbcc1')
  })

  it('terminal:destroy → 잘못된 id 형식 → validateIpc 가 errorResponse', () => {
    const result = getHandler<{ success: boolean }>('terminal:destroy')({}, 'x')
    expect(result).toMatchObject({ success: false })
    expect(terminalService.destroy).not.toHaveBeenCalled()
  })

  it('terminal:write → service.write 호출 (ipcMain.on 등록된 fire-and-forget)', () => {
    getHandler('terminal:write')({}, { id: 'newid-aabbcc1', data: 'ls\n' })
    expect(terminalService.write).toHaveBeenCalledWith('newid-aabbcc1', 'ls\n')
  })

  it('terminal:resize → service.resize 호출', () => {
    getHandler('terminal:resize')({}, { id: 'newid-aabbcc1', cols: 100, rows: 30 })
    expect(terminalService.resize).toHaveBeenCalledWith('newid-aabbcc1', 100, 30)
  })

  it('terminal:saveSnapshot → repository.saveSnapshot', () => {
    getHandler('terminal:saveSnapshot')({}, 'newid-aabbcc1', 'SCREEN-DATA')
    expect(terminalSessionRepository.saveSnapshot).toHaveBeenCalledWith('newid-aabbcc1', 'SCREEN-DATA')
  })

  it('terminal:getSessions → repository.findActiveByWorkspaceId', () => {
    vi.mocked(terminalSessionRepository.findActiveByWorkspaceId).mockReturnValue([])
    const result = getHandler('terminal:getSessions')({}, 'ws-aabbcc12')
    expect(terminalSessionRepository.findActiveByWorkspaceId).toHaveBeenCalledWith('ws-aabbcc12')
    expect(result).toEqual({ success: true, data: [] })
  })

  it('terminal:getLayout → 없으면 null', () => {
    vi.mocked(terminalLayoutRepository.findByWorkspaceId).mockReturnValue(undefined)
    const result = getHandler('terminal:getLayout')({}, 'ws-aabbcc12')
    expect(result).toEqual({ success: true, data: null })
  })

  it('terminal:saveLayout → repository.upsert', () => {
    getHandler('terminal:saveLayout')({}, 'ws-aabbcc12', '{"x":1}')
    expect(terminalLayoutRepository.upsert).toHaveBeenCalledWith('ws-aabbcc12', '{"x":1}')
  })

  it('terminal:closeSession → repository.softDelete', () => {
    getHandler('terminal:closeSession')({}, 'newid-aabbcc1')
    expect(terminalSessionRepository.softDelete).toHaveBeenCalledWith('newid-aabbcc1')
  })
})
