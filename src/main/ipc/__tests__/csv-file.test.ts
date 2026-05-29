/**
 * csv-file IPC 핸들러 회귀 테스트. note 와 동일 패턴.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('../../services/csv-file', () => ({
  csvFileService: {
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

import { registerCsvFileHandlers } from '../csv-file'
import { csvFileService } from '../../services/csv-file'
import { dialog } from 'electron'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerCsvFileHandlers()
})

describe('csv-file IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'csv:readByWorkspace',
      'csv:create',
      'csv:rename',
      'csv:remove',
      'csv:readContent',
      'csv:writeContent',
      'csv:move',
      'csv:updateMeta',
      'csv:duplicate',
      'csv:import',
      'csv:toggleLock',
      'csv:selectFile'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('csv:writeContent → service 위임', () => {
    getHandler('csv:writeContent')({}, 'ws-aabbcc12', 'csv-aabbcc', 'a,b\n1,2')
    expect(csvFileService.writeContent).toHaveBeenCalledWith(
      'ws-aabbcc12',
      'csv-aabbcc',
      'a,b\n1,2'
    )
  })

  it('csv:updateMeta → data 객체 그대로 전달', () => {
    const data = { description: 'd', columnWidths: '[10,20]' }
    getHandler('csv:updateMeta')({}, 'ws-aabbcc12', 'csv-aabbcc', data)
    expect(csvFileService.updateMeta).toHaveBeenCalledWith('ws-aabbcc12', 'csv-aabbcc', data)
  })

  it('csv:move → folderId null + index 0', () => {
    getHandler('csv:move')({}, 'ws-aabbcc12', 'csv-aabbcc', null, 0)
    expect(csvFileService.move).toHaveBeenCalledWith('ws-aabbcc12', 'csv-aabbcc', null, 0)
  })

  it('csv:selectFile → CSV filter 사용', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/x.csv'] })
    const result = await getHandler<string[] | null>('csv:selectFile')()
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ name: 'CSV', extensions: ['csv'] }] })
    )
    expect(result).toEqual(['/x.csv'])
  })
})
