/**
 * image-file IPC 핸들러 회귀 테스트. note/csv 와 동일 패턴.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('../../services/image-file', () => ({
  imageFileService: {
    readByWorkspaceFromDb: vi.fn(),
    import: vi.fn(),
    duplicate: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    readContent: vi.fn(),
    move: vi.fn(),
    updateMeta: vi.fn()
  }
}))

import { registerImageFileHandlers } from '../image-file'
import { imageFileService } from '../../services/image-file'
import { dialog } from 'electron'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerImageFileHandlers()
})

describe('image-file IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'image:readByWorkspace',
      'image:import',
      'image:duplicate',
      'image:rename',
      'image:remove',
      'image:readContent',
      'image:move',
      'image:updateMeta',
      'image:selectFile'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('image:import → workspaceId/folderId/sourcePath 전달', () => {
    getHandler('image:import')({}, 'ws-aabbcc12', null, '/src/img.png')
    expect(imageFileService.import).toHaveBeenCalledWith('ws-aabbcc12', null, '/src/img.png')
  })

  it('image:rename → 3 args 전달', () => {
    getHandler('image:rename')({}, 'ws-aabbcc12', 'img-aabbcc', 'newName')
    expect(imageFileService.rename).toHaveBeenCalledWith('ws-aabbcc12', 'img-aabbcc', 'newName')
  })

  it('image:move → folderId/index 전달', () => {
    getHandler('image:move')({}, 'ws-aabbcc12', 'img-aabbcc', 'fold-aabbcc', 5)
    expect(imageFileService.move).toHaveBeenCalledWith(
      'ws-aabbcc12',
      'img-aabbcc',
      'fold-aabbcc',
      5
    )
  })

  it('image:selectFile → 이미지 확장자 필터', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a.png']
    })
    const result = await getHandler<string[] | null>('image:selectFile')()
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [expect.objectContaining({ extensions: expect.arrayContaining(['png', 'jpg']) })]
      })
    )
    expect(result).toEqual(['/a.png'])
  })
})
