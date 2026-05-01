import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canvasEdgeService } from '../canvas-edge'
import { canvasRepository } from '../../repositories/canvas'
import { canvasNodeRepository } from '../../repositories/canvas-node'
import { canvasEdgeRepository } from '../../repositories/canvas-edge'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-edge', () => ({
  canvasEdgeRepository: {
    findByCanvasId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

const MOCK_CANVAS = { id: 'canvas-1' }
const MOCK_FROM_NODE = { id: 'node-a' }
const MOCK_TO_NODE = { id: 'node-b' }

const MOCK_EDGE_ROW = {
  id: 'edge-1',
  canvasId: 'canvas-1',
  fromNode: 'node-a',
  toNode: 'node-b',
  fromSide: 'right' as const,
  toSide: 'left' as const,
  label: null,
  color: null,
  style: 'solid' as const,
  arrow: 'end' as const,
  createdAt: new Date(),
  deletedAt: null,
  trashBatchId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS as never)
  vi.mocked(canvasNodeRepository.findById).mockImplementation(
    (id: string) =>
      ({
        'node-a': MOCK_FROM_NODE,
        'node-b': MOCK_TO_NODE
      })[id] as never
  )
  vi.mocked(canvasEdgeRepository.findByCanvasId).mockReturnValue([])
})

describe('findByCanvas', () => {
  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasEdgeService.findByCanvas('bad')).toThrow(NotFoundError)
  })

  it('정상 — CanvasEdgeItem[] 반환, createdAt Date 인스턴스', () => {
    vi.mocked(canvasEdgeRepository.findByCanvasId).mockReturnValue([MOCK_EDGE_ROW])
    const result = canvasEdgeService.findByCanvas('canvas-1')
    expect(result).toHaveLength(1)
    expect(result[0].createdAt).toBeInstanceOf(Date)
  })
})

describe('create', () => {
  beforeEach(() => {
    vi.mocked(canvasEdgeRepository.create).mockReturnValue(MOCK_EDGE_ROW)
  })

  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasEdgeService.create('bad', { fromNode: 'node-a', toNode: 'node-b' })).toThrow(
      NotFoundError
    )
  })

  it('self-loop → ValidationError', () => {
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'node-a' })
    ).toThrow(ValidationError)
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'node-a' })
    ).toThrow('Cannot create self-loop edge')
  })

  it('fromNode 없음 → NotFoundError', () => {
    vi.mocked(canvasNodeRepository.findById).mockImplementation(
      (id: string) => ({ 'node-b': MOCK_TO_NODE })[id] as never
    )
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'bad', toNode: 'node-b' })
    ).toThrow(NotFoundError)
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'bad', toNode: 'node-b' })
    ).toThrow('From node not found')
  })

  it('toNode 없음 → NotFoundError', () => {
    vi.mocked(canvasNodeRepository.findById).mockImplementation(
      (id: string) => ({ 'node-a': MOCK_FROM_NODE })[id] as never
    )
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'bad' })
    ).toThrow(NotFoundError)
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'bad' })
    ).toThrow('To node not found')
  })

  it('중복 엣지 (같은 방향) → ValidationError', () => {
    vi.mocked(canvasEdgeRepository.findByCanvasId).mockReturnValue([MOCK_EDGE_ROW])
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'node-b' })
    ).toThrow(ValidationError)
    vi.mocked(canvasEdgeRepository.findByCanvasId).mockReturnValue([MOCK_EDGE_ROW])
    expect(() =>
      canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'node-b' })
    ).toThrow('Duplicate edge already exists')
  })

  it('역방향 엣지 — 중복 아님 (정상 생성)', () => {
    // A→B 존재 시 B→A는 허용
    vi.mocked(canvasEdgeRepository.findByCanvasId).mockReturnValue([MOCK_EDGE_ROW])
    canvasEdgeService.create('canvas-1', { fromNode: 'node-b', toNode: 'node-a' })
    expect(canvasEdgeRepository.create).toHaveBeenCalled()
  })

  it('정상 + 기본값 확인', () => {
    canvasEdgeService.create('canvas-1', { fromNode: 'node-a', toNode: 'node-b' })
    expect(canvasEdgeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-id',
        canvasId: 'canvas-1',
        fromNode: 'node-a',
        toNode: 'node-b',
        fromSide: 'right',
        toSide: 'left',
        label: null,
        color: null,
        style: 'solid',
        arrow: 'end'
      })
    )
  })

  it('정상 + 커스텀 값', () => {
    canvasEdgeService.create('canvas-1', {
      fromNode: 'node-a',
      toNode: 'node-b',
      fromSide: 'top',
      toSide: 'bottom',
      style: 'dashed',
      arrow: 'both',
      label: '연결',
      color: '#ff0000'
    })
    expect(canvasEdgeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fromSide: 'top',
        toSide: 'bottom',
        style: 'dashed',
        arrow: 'both',
        label: '연결',
        color: '#ff0000'
      })
    )
  })
})

describe('update', () => {
  beforeEach(() => {
    vi.mocked(canvasEdgeRepository.findById).mockReturnValue(MOCK_EDGE_ROW)
    vi.mocked(canvasEdgeRepository.update).mockReturnValue(MOCK_EDGE_ROW)
  })

  it('edge 없음 (findById) → NotFoundError', () => {
    vi.mocked(canvasEdgeRepository.findById).mockReturnValue(undefined)
    expect(() => canvasEdgeService.update('bad', { style: 'dashed' })).toThrow(NotFoundError)
  })

  it('edge 없음 (update 반환 undefined) → NotFoundError', () => {
    vi.mocked(canvasEdgeRepository.update).mockReturnValue(undefined)
    expect(() => canvasEdgeService.update('edge-1', { style: 'dashed' })).toThrow(NotFoundError)
  })

  it('style만 변경 — 해당 필드만 포함', () => {
    canvasEdgeService.update('edge-1', { style: 'dotted' })
    expect(canvasEdgeRepository.update).toHaveBeenCalledWith('edge-1', { style: 'dotted' })
  })
})

describe('remove', () => {
  it('edge 없음 → NotFoundError', () => {
    vi.mocked(canvasEdgeRepository.findById).mockReturnValue(undefined)
    expect(() => canvasEdgeService.remove('bad')).toThrow(NotFoundError)
  })

  it('정상 — canvasEdgeRepository.delete 호출', () => {
    vi.mocked(canvasEdgeRepository.findById).mockReturnValue(MOCK_EDGE_ROW)
    canvasEdgeService.remove('edge-1')
    expect(canvasEdgeRepository.delete).toHaveBeenCalledWith('edge-1')
  })
})
