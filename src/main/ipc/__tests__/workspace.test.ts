/**
 * workspace IPC 핸들러 회귀 테스트.
 * - create: validateIpc + workspaceService.create + ensureClaudeCommands
 * - update: path 변경 시 workspaceWatcher.ensureWatching 호출
 * - activate: ensureClaudeCommands + ensureWatching
 * - selectDirectory: dialog 위임
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('../../services/workspace', () => ({
  workspaceService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('../../services/workspace-watcher', () => ({
  workspaceWatcher: { ensureWatching: vi.fn() }
}))
vi.mock('../../services/claude-commands-setup', () => ({
  ensureClaudeCommands: vi.fn()
}))

import { registerWorkspaceHandlers } from '../workspace'
import { workspaceService } from '../../services/workspace'
import { workspaceWatcher } from '../../services/workspace-watcher'
import { ensureClaudeCommands } from '../../services/claude-commands-setup'
import { dialog } from 'electron'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerWorkspaceHandlers()
})

describe('workspace IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'workspace:getAll',
      'workspace:getById',
      'workspace:create',
      'workspace:update',
      'workspace:delete',
      'workspace:activate',
      'workspace:selectDirectory'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('workspace:getAll → service 위임', () => {
    vi.mocked(workspaceService.getAll).mockReturnValue([])
    const result = getHandler('workspace:getAll')()
    expect(result).toEqual({ success: true, data: [] })
  })

  it('workspace:create → 정상 생성 시 ensureClaudeCommands 호출', () => {
    vi.mocked(workspaceService.create).mockReturnValue({
      id: 'ws-newaabb',
      name: 'New',
      path: '/Users/test/new',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const result = getHandler('workspace:create')({}, 'New', '/Users/test/new')

    expect(workspaceService.create).toHaveBeenCalledWith('New', '/Users/test/new')
    expect(ensureClaudeCommands).toHaveBeenCalledWith('/Users/test/new')
    expect(result).toMatchObject({ success: true })
  })

  it('workspace:create → 잘못된 path (validateIpc) → errorResponse', () => {
    // path 가 빈 문자열이면 workspacePathSchema 검증 실패
    const result = getHandler<{ success: boolean }>('workspace:create')({}, 'New', '')
    expect(result).toMatchObject({ success: false })
    expect(workspaceService.create).not.toHaveBeenCalled()
  })

  it('workspace:update → path 변경 시 ensureWatching 호출', () => {
    vi.mocked(workspaceService.update).mockReturnValue({
      id: 'ws-aabbcc12',
      name: 'X',
      path: '/new/path',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    getHandler('workspace:update')({}, 'ws-aabbcc12', { path: '/new/path' })

    expect(workspaceWatcher.ensureWatching).toHaveBeenCalledWith('ws-aabbcc12', '/new/path')
  })

  it('workspace:update → path 미변경 시 ensureWatching 미호출', () => {
    vi.mocked(workspaceService.update).mockReturnValue({
      id: 'ws-aabbcc12',
      name: 'X-renamed',
      path: '/p',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    getHandler('workspace:update')({}, 'ws-aabbcc12', { name: 'X-renamed' })

    expect(workspaceWatcher.ensureWatching).not.toHaveBeenCalled()
  })

  it('workspace:activate → ensureClaudeCommands + ensureWatching', () => {
    vi.mocked(workspaceService.getById).mockReturnValue({
      id: 'ws-aabbcc12',
      name: 'X',
      path: '/p',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    getHandler('workspace:activate')({}, 'ws-aabbcc12')

    expect(ensureClaudeCommands).toHaveBeenCalledWith('/p')
    expect(workspaceWatcher.ensureWatching).toHaveBeenCalledWith('ws-aabbcc12', '/p')
  })

  it('workspace:selectDirectory → 취소 시 null', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] })
    const result = await getHandler<string | null>('workspace:selectDirectory')()
    expect(result).toBeNull()
  })

  it('workspace:selectDirectory → 선택 시 첫 번째 path', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/picked']
    })
    const result = await getHandler<string | null>('workspace:selectDirectory')()
    expect(result).toBe('/picked')
  })
})
