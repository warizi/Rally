import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canvasService } from '../canvas'
import { canvasRepository } from '../../repositories/canvas'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas', () => ({
  canvasRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateViewport: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

const MOCK_WS = {
  id: 'ws-1',
  name: 'Test',
  path: '/test',
  createdAt: new Date(),
  updatedAt: new Date()
}

const MOCK_CANVAS_ROW = {
  id: 'canvas-1',
  workspaceId: 'ws-1',
  title: 'Test',
  description: '',
  viewportX: 0,
  viewportY: 0,
  viewportZoom: 1,
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
})

describe('findByWorkspace', () => {
  it('정상 — CanvasItem[] 반환, Date 타입 확인', () => {
    vi.mocked(canvasRepository.findByWorkspaceId).mockReturnValue([MOCK_CANVAS_ROW])
    const result = canvasService.findByWorkspace('ws-1')
    expect(result).toHaveLength(1)
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)
  })

  it('workspace 없음 → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => canvasService.findByWorkspace('ws-bad')).toThrow(NotFoundError)
  })
})

describe('findById', () => {
  it('정상 — CanvasItem 반환', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS_ROW)
    const result = canvasService.findById('canvas-1')
    expect(result.id).toBe('canvas-1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasService.findById('bad')).toThrow(NotFoundError)
  })
})

describe('create', () => {
  beforeEach(() => {
    vi.mocked(canvasRepository.create).mockReturnValue(MOCK_CANVAS_ROW)
  })

  it('정상 생성 — nanoid ID, timestamps = Date', () => {
    canvasService.create('ws-1', { title: 'New' })
    expect(canvasRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-id',
        workspaceId: 'ws-1',
        title: 'New',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    )
  })

  it('title trim 적용', () => {
    canvasService.create('ws-1', { title: '  제목  ' })
    expect(canvasRepository.create).toHaveBeenCalledWith(expect.objectContaining({ title: '제목' }))
  })

  it('description 미전달 → 빈 문자열', () => {
    canvasService.create('ws-1', { title: 'New' })
    expect(canvasRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: '' })
    )
  })

  it('description trim 적용', () => {
    canvasService.create('ws-1', { title: 'New', description: '  설명  ' })
    expect(canvasRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: '설명' })
    )
  })

  it('workspace 없음 → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => canvasService.create('ws-bad', { title: 'x' })).toThrow(NotFoundError)
  })
})

describe('update', () => {
  beforeEach(() => {
    vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS_ROW)
    vi.mocked(canvasRepository.update).mockReturnValue(MOCK_CANVAS_ROW)
  })

  it('title만 변경 — trim 적용 + updatedAt 설정', () => {
    canvasService.update('canvas-1', { title: '  수정  ' })
    expect(canvasRepository.update).toHaveBeenCalledWith(
      'canvas-1',
      expect.objectContaining({ title: '수정', updatedAt: expect.any(Date) })
    )
  })

  it('description만 변경 — trim 적용', () => {
    canvasService.update('canvas-1', { description: '  desc  ' })
    expect(canvasRepository.update).toHaveBeenCalledWith(
      'canvas-1',
      expect.objectContaining({ description: 'desc' })
    )
  })

  it('canvas findById 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasService.update('bad', { title: 'x' })).toThrow(NotFoundError)
  })

  it('canvas update 반환 undefined → NotFoundError', () => {
    vi.mocked(canvasRepository.update).mockReturnValue(undefined)
    expect(() => canvasService.update('canvas-1', { title: 'x' })).toThrow(NotFoundError)
  })
})

describe('updateViewport', () => {
  beforeEach(() => {
    vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS_ROW)
  })

  it('x/y/zoom → viewportX/viewportY/viewportZoom 매핑', () => {
    canvasService.updateViewport('canvas-1', { x: 100, y: 200, zoom: 1.5 })
    expect(canvasRepository.updateViewport).toHaveBeenCalledWith('canvas-1', {
      viewportX: 100,
      viewportY: 200,
      viewportZoom: 1.5
    })
  })

  it('updatedAt 미전달 확인', () => {
    canvasService.updateViewport('canvas-1', { x: 0, y: 0, zoom: 1 })
    const callArgs = vi.mocked(canvasRepository.updateViewport).mock.calls[0][1]
    expect(callArgs).not.toHaveProperty('updatedAt')
  })

  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasService.updateViewport('bad', { x: 0, y: 0, zoom: 1 })).toThrow(
      NotFoundError
    )
  })
})

describe('remove', () => {
  it('정상 — canvasRepository.delete 호출', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS_ROW)
    canvasService.remove('canvas-1')
    expect(canvasRepository.delete).toHaveBeenCalledWith('canvas-1')
  })

  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasService.remove('bad')).toThrow(NotFoundError)
  })
})
