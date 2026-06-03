/**
 * canvas-node IPC 핸들러 회귀 테스트.
 * syncState 는 nodes/edges 구조 분해해서 service 에 전달하는 분기 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/canvas-node', () => ({
  canvasNodeService: {
    findByCanvas: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updatePositions: vi.fn(),
    remove: vi.fn(),
    syncState: vi.fn()
  }
}))

import { registerCanvasNodeHandlers } from '../canvas-node'
import { canvasNodeService } from '../../services/canvas-node'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerCanvasNodeHandlers()
})

describe('canvas-node IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'canvasNode:findByCanvas',
      'canvasNode:create',
      'canvasNode:update',
      'canvasNode:updatePositions',
      'canvasNode:remove',
      'canvasNode:syncState'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('canvasNode:findByCanvas → 위임', () => {
    vi.mocked(canvasNodeService.findByCanvas).mockReturnValue([])
    const result = getHandler('canvasNode:findByCanvas')({}, 'canv-aabbcc')
    expect(canvasNodeService.findByCanvas).toHaveBeenCalledWith('canv-aabbcc')
    expect(result).toEqual({ success: true, data: [] })
  })

  it('canvasNode:updatePositions → updates 배열 전달', () => {
    const updates = [
      { id: 'n1', x: 10, y: 20 },
      { id: 'n2', x: 30, y: 40 }
    ]
    getHandler('canvasNode:updatePositions')({}, updates)
    expect(canvasNodeService.updatePositions).toHaveBeenCalledWith(updates)
  })

  it('canvasNode:syncState → nodes/edges/groups 분해 후 service 호출', () => {
    const nodes = [{ id: 'n1' }]
    const edges = [{ id: 'e1' }]
    getHandler('canvasNode:syncState')({}, 'canv-aabbcc', { nodes, edges })
    // groups 미지정 시 빈 배열로 전달
    expect(canvasNodeService.syncState).toHaveBeenCalledWith('canv-aabbcc', nodes, edges, [])
  })

  it('canvasNode:syncState → groups 지정 시 그대로 전달', () => {
    const nodes = [{ id: 'n1' }]
    const edges = [{ id: 'e1' }]
    const groups = [{ id: 'g1' }]
    getHandler('canvasNode:syncState')({}, 'canv-aabbcc', { nodes, edges, groups })
    expect(canvasNodeService.syncState).toHaveBeenCalledWith('canv-aabbcc', nodes, edges, groups)
  })

  it('canvasNode:remove → nodeId 전달', () => {
    getHandler('canvasNode:remove')({}, 'node-aabbcc')
    expect(canvasNodeService.remove).toHaveBeenCalledWith('node-aabbcc')
  })
})
