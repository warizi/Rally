/**
 * folder IPC 핸들러 회귀 테스트.
 * - readTree 는 watcher.ensureWatching 을 fire-and-forget 으로 호출 후 DB 즉시 반환
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/folder', () => ({
  folderService: {
    readTreeFromDb: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    updateMeta: vi.fn()
  }
}))
vi.mock('../../services/workspace-watcher', () => ({
  workspaceWatcher: { ensureWatching: vi.fn() }
}))
vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { registerFolderHandlers } from '../folder'
import { folderService } from '../../services/folder'
import { workspaceWatcher } from '../../services/workspace-watcher'
import { workspaceRepository } from '../../repositories/workspace'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerFolderHandlers()
})

describe('folder IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'folder:readTree',
      'folder:create',
      'folder:rename',
      'folder:remove',
      'folder:move',
      'folder:updateMeta'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('folder:readTree → workspace 발견 시 watcher 활성 + tree 반환', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue({
      id: 'ws-aabbcc12',
      name: 'WS',
      path: '/p',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    vi.mocked(folderService.readTreeFromDb).mockReturnValue([])

    const result = getHandler('folder:readTree')({}, 'ws-aabbcc12')

    expect(workspaceWatcher.ensureWatching).toHaveBeenCalledWith('ws-aabbcc12', '/p')
    expect(folderService.readTreeFromDb).toHaveBeenCalledWith('ws-aabbcc12')
    expect(result).toEqual({ success: true, data: [] })
  })

  it('folder:readTree → workspace 없으면 watcher 비활성 + tree 만 반환', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    vi.mocked(folderService.readTreeFromDb).mockReturnValue([])

    getHandler('folder:readTree')({}, 'ws-missing12')
    expect(workspaceWatcher.ensureWatching).not.toHaveBeenCalled()
  })

  it('folder:create → service 위임', () => {
    getHandler('folder:create')({}, 'ws-aabbcc12', null, 'docs')
    expect(folderService.create).toHaveBeenCalledWith('ws-aabbcc12', null, 'docs')
  })

  it('folder:move → 4 args 전달', () => {
    getHandler('folder:move')({}, 'ws-aabbcc12', 'fold-aabbcc', 'fold-parent', 2)
    expect(folderService.move).toHaveBeenCalledWith('ws-aabbcc12', 'fold-aabbcc', 'fold-parent', 2)
  })

  it('folder:updateMeta → color/order 전달', () => {
    getHandler('folder:updateMeta')({}, 'ws-aabbcc12', 'fold-aabbcc', { color: '#ff0000', order: 5 })
    expect(folderService.updateMeta).toHaveBeenCalledWith('ws-aabbcc12', 'fold-aabbcc', {
      color: '#ff0000',
      order: 5
    })
  })
})
