import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canvasGroupService } from '../canvas-group'
import { canvasRepository } from '../../repositories/canvas'
import { canvasGroupRepository } from '../../repositories/canvas-group'
import { canvasNodeRepository } from '../../repositories/canvas-node'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-group', () => ({
  canvasGroupRepository: {
    findByCanvasId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: { clearGroupId: vi.fn() }
}))

vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

const MOCK_CANVAS = { id: 'canvas-1', isLocked: false, title: 'C1' }

const MOCK_GROUP_ROW = {
  id: 'group-1',
  canvasId: 'canvas-1',
  label: '그룹',
  x: 10,
  y: 20,
  width: 300,
  height: 200,
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  trashBatchId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS as never)
})

describe('findByCanvas', () => {
  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasGroupService.findByCanvas('bad')).toThrow(NotFoundError)
  })

  it('정상 — CanvasGroupItem[], createdAt/updatedAt Date 인스턴스', () => {
    vi.mocked(canvasGroupRepository.findByCanvasId).mockReturnValue([MOCK_GROUP_ROW])
    const result = canvasGroupService.findByCanvas('canvas-1')
    expect(result).toHaveLength(1)
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)
    expect(result[0].label).toBe('그룹')
  })
})

describe('create', () => {
  beforeEach(() => {
    vi.mocked(canvasGroupRepository.create).mockReturnValue(MOCK_GROUP_ROW)
  })

  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasGroupService.create('bad', { x: 0, y: 0, width: 100, height: 100 })).toThrow(
      NotFoundError
    )
  })

  it('잠금 캔버스 → 수정 불가 (LockedError)', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue({
      ...MOCK_CANVAS,
      isLocked: true
    } as never)
    expect(() =>
      canvasGroupService.create('canvas-1', { x: 0, y: 0, width: 100, height: 100 })
    ).toThrow()
  })

  it('width <= 0 → ValidationError', () => {
    expect(() =>
      canvasGroupService.create('canvas-1', { x: 0, y: 0, width: 0, height: 100 })
    ).toThrow(ValidationError)
  })

  it('height <= 0 → ValidationError', () => {
    expect(() =>
      canvasGroupService.create('canvas-1', { x: 0, y: 0, width: 100, height: -5 })
    ).toThrow(ValidationError)
  })

  it('정상 + 기본값(label/color null)', () => {
    canvasGroupService.create('canvas-1', { x: 10, y: 20, width: 300, height: 200 })
    expect(canvasGroupRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-id',
        canvasId: 'canvas-1',
        label: null,
        color: null,
        x: 10,
        y: 20,
        width: 300,
        height: 200
      })
    )
  })

  it('정상 + 커스텀 값', () => {
    canvasGroupService.create('canvas-1', {
      label: '작업 그룹',
      color: '#ff0000',
      x: 1,
      y: 2,
      width: 50,
      height: 60
    })
    expect(canvasGroupRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: '작업 그룹', color: '#ff0000' })
    )
  })
})

describe('update', () => {
  beforeEach(() => {
    vi.mocked(canvasGroupRepository.findById).mockReturnValue(MOCK_GROUP_ROW)
    vi.mocked(canvasGroupRepository.update).mockReturnValue(MOCK_GROUP_ROW)
  })

  it('group 없음 (findById) → NotFoundError', () => {
    vi.mocked(canvasGroupRepository.findById).mockReturnValue(undefined)
    expect(() => canvasGroupService.update('bad', { label: 'x' })).toThrow(NotFoundError)
  })

  it('group 없음 (update 반환 undefined) → NotFoundError', () => {
    vi.mocked(canvasGroupRepository.update).mockReturnValue(undefined)
    expect(() => canvasGroupService.update('group-1', { label: 'x' })).toThrow(NotFoundError)
  })

  it('width <= 0 → ValidationError', () => {
    expect(() => canvasGroupService.update('group-1', { width: -1 })).toThrow(ValidationError)
  })

  it('label만 변경 — 해당 필드만 포함', () => {
    canvasGroupService.update('group-1', { label: '바뀐 라벨' })
    expect(canvasGroupRepository.update).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ label: '바뀐 라벨' })
    )
  })

  it('label=null 허용 (라벨 제거)', () => {
    canvasGroupService.update('group-1', { label: null })
    expect(canvasGroupRepository.update).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ label: null })
    )
  })
})

describe('remove', () => {
  it('group 없음 → NotFoundError', () => {
    vi.mocked(canvasGroupRepository.findById).mockReturnValue(undefined)
    expect(() => canvasGroupService.remove('bad')).toThrow(NotFoundError)
  })

  it('정상 — 멤버 groupId 해제 후 그룹 삭제', () => {
    vi.mocked(canvasGroupRepository.findById).mockReturnValue(MOCK_GROUP_ROW)
    canvasGroupService.remove('group-1')
    expect(canvasNodeRepository.clearGroupId).toHaveBeenCalledWith('group-1')
    expect(canvasGroupRepository.delete).toHaveBeenCalledWith('group-1')
  })
})
