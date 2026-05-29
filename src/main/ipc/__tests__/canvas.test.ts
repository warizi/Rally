/**
 * canvas IPC 핸들러 회귀 테스트. canvas.ts 는 작아 한 번에 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/canvas', () => ({
  canvasService: {
    findByWorkspace: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateViewport: vi.fn(),
    remove: vi.fn(),
    toggleLock: vi.fn()
  }
}))

import { registerCanvasHandlers } from '../canvas'
import { canvasService } from '../../services/canvas'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerCanvasHandlers()
})

describe('canvas IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'canvas:findByWorkspace',
      'canvas:findById',
      'canvas:create',
      'canvas:update',
      'canvas:updateViewport',
      'canvas:remove',
      'canvas:toggleLock'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('canvas:findByWorkspace → options.search 전달', () => {
    vi.mocked(canvasService.findByWorkspace).mockReturnValue([])
    const result = getHandler('canvas:findByWorkspace')({}, 'ws-aabbcc12', { search: 'mind' })
    expect(canvasService.findByWorkspace).toHaveBeenCalledWith('ws-aabbcc12', 'mind')
    expect(result).toEqual({ success: true, data: [] })
  })

  it('canvas:updateViewport → viewport 객체 전달', () => {
    getHandler('canvas:updateViewport')({}, 'canv-aabbcc', { x: 10, y: 20, zoom: 1.5 })
    expect(canvasService.updateViewport).toHaveBeenCalledWith('canv-aabbcc', {
      x: 10,
      y: 20,
      zoom: 1.5
    })
  })

  it('canvas:toggleLock → boolean 전달', () => {
    getHandler('canvas:toggleLock')({}, 'canv-aabbcc', true)
    expect(canvasService.toggleLock).toHaveBeenCalledWith('canv-aabbcc', true)
  })

  it('canvas:create → workspace + data 전달', () => {
    vi.mocked(canvasService.create).mockReturnValue({ id: 'canv-newaab' } as ReturnType<
      typeof canvasService.create
    >)
    const result = getHandler('canvas:create')({}, 'ws-aabbcc12', { title: 'X' })
    expect(canvasService.create).toHaveBeenCalledWith('ws-aabbcc12', { title: 'X' })
    expect(result).toMatchObject({ success: true })
  })

  it('canvas:update → id + data 전달', () => {
    getHandler('canvas:update')({}, 'canv-aabbcc', { title: 'renamed' })
    expect(canvasService.update).toHaveBeenCalledWith('canv-aabbcc', { title: 'renamed' })
  })

  it('canvas:remove → id 전달', () => {
    getHandler('canvas:remove')({}, 'canv-aabbcc')
    expect(canvasService.remove).toHaveBeenCalledWith('canv-aabbcc')
  })
})
