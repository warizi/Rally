/**
 * note IPC 핸들러 회귀 테스트.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('../../services/note', () => ({
  noteService: {
    readByWorkspaceFromDb: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    readContent: vi.fn(),
    writeContent: vi.fn(),
    move: vi.fn(),
    updateMeta: vi.fn(),
    duplicate: vi.fn(),
    import: vi.fn(),
    toggleLock: vi.fn()
  }
}))

import { registerNoteHandlers } from '../note'
import { noteService } from '../../services/note'
import { dialog } from 'electron'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerNoteHandlers()
})

describe('note IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'note:readByWorkspace',
      'note:create',
      'note:rename',
      'note:remove',
      'note:readContent',
      'note:writeContent',
      'note:move',
      'note:updateMeta',
      'note:duplicate',
      'note:import',
      'note:toggleLock',
      'note:selectFile'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('note:create → service 위임 + successResponse', () => {
    vi.mocked(noteService.create).mockReturnValue({ id: 'n-aabbcc1' } as ReturnType<typeof noteService.create>)
    const result = getHandler('note:create')({}, 'ws-aabbcc12', null, 'new note')
    expect(noteService.create).toHaveBeenCalledWith('ws-aabbcc12', null, 'new note')
    expect(result).toMatchObject({ success: true })
  })

  it('note:writeContent → 4 args 전달', () => {
    getHandler('note:writeContent')({}, 'ws-aabbcc12', 'n-aabbcc1', '# hello')
    expect(noteService.writeContent).toHaveBeenCalledWith('ws-aabbcc12', 'n-aabbcc1', '# hello')
  })

  it('note:toggleLock → boolean 전달', () => {
    getHandler('note:toggleLock')({}, 'ws-aabbcc12', 'n-aabbcc1', true)
    expect(noteService.toggleLock).toHaveBeenCalledWith('ws-aabbcc12', 'n-aabbcc1', true)
  })

  it('note:selectFile → dialog 취소 → null', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] })
    const result = await getHandler<string[] | null>('note:selectFile')()
    expect(result).toBeNull()
  })

  it('note:selectFile → 선택 시 filePaths 반환', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a.md', '/b.md']
    })
    const result = await getHandler<string[] | null>('note:selectFile')()
    expect(result).toEqual(['/a.md', '/b.md'])
  })
})
