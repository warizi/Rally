/**
 * pdf-file IPC 핸들러 회귀 테스트. image-file 과 동일 패턴.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('../../services/pdf-file', () => ({
  pdfFileService: {
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

import { registerPdfFileHandlers } from '../pdf-file'
import { pdfFileService } from '../../services/pdf-file'
import { dialog } from 'electron'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerPdfFileHandlers()
})

describe('pdf-file IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'pdf:readByWorkspace',
      'pdf:import',
      'pdf:duplicate',
      'pdf:rename',
      'pdf:remove',
      'pdf:readContent',
      'pdf:move',
      'pdf:updateMeta',
      'pdf:selectFile'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('pdf:import → 3 args 전달', () => {
    getHandler('pdf:import')({}, 'ws-aabbcc12', null, '/src/doc.pdf')
    expect(pdfFileService.import).toHaveBeenCalledWith('ws-aabbcc12', null, '/src/doc.pdf')
  })

  it('pdf:rename → 위임', () => {
    getHandler('pdf:rename')({}, 'ws-aabbcc12', 'pdf-aabbcc', 'newName')
    expect(pdfFileService.rename).toHaveBeenCalledWith('ws-aabbcc12', 'pdf-aabbcc', 'newName')
  })

  it('pdf:updateMeta → data 전달', () => {
    getHandler('pdf:updateMeta')({}, 'ws-aabbcc12', 'pdf-aabbcc', { description: 'desc' })
    expect(pdfFileService.updateMeta).toHaveBeenCalledWith('ws-aabbcc12', 'pdf-aabbcc', {
      description: 'desc'
    })
  })

  it('pdf:selectFile → 단일 파일 (multiSelections 없음) → filePaths[0]', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a.pdf']
    })
    const result = await getHandler<string | null>('pdf:selectFile')()
    expect(dialog.showOpenDialog).toHaveBeenCalled()
    expect(result).toBe('/a.pdf')
  })

  it('pdf:selectFile → 취소 시 null', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] })
    const result = await getHandler<string | null>('pdf:selectFile')()
    expect(result).toBeNull()
  })
})
