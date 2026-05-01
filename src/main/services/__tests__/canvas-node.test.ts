import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canvasNodeService } from '../canvas-node'
import { canvasRepository } from '../../repositories/canvas'
import { canvasNodeRepository } from '../../repositories/canvas-node'
import { todoRepository } from '../../repositories/todo'
import { noteRepository } from '../../repositories/note'
import { scheduleRepository } from '../../repositories/schedule'
import { csvFileRepository } from '../../repositories/csv-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { imageFileRepository } from '../../repositories/image-file'
import { NotFoundError } from '../../lib/errors'

vi.mock('../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: {
    findByCanvasId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    bulkUpdatePositions: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../repositories/todo', () => ({
  todoRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/note', () => ({
  noteRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/schedule', () => ({
  scheduleRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/csv-file', () => ({
  csvFileRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/pdf-file', () => ({
  pdfFileRepository: { findByIds: vi.fn() }
}))
vi.mock('../../repositories/image-file', () => ({
  imageFileRepository: { findByIds: vi.fn() }
}))

vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

const MOCK_CANVAS = { id: 'canvas-1' }

const MOCK_NODE_ROW = {
  id: 'node-1',
  canvasId: 'canvas-1',
  type: 'text' as const,
  refId: null,
  x: 100,
  y: 200,
  width: 260,
  height: 160,
  color: null,
  content: 'hello',
  zIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  trashBatchId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canvasRepository.findById).mockReturnValue(MOCK_CANVAS as never)
  vi.mocked(todoRepository.findByIds).mockReturnValue([])
  vi.mocked(noteRepository.findByIds).mockReturnValue([])
  vi.mocked(scheduleRepository.findByIds).mockReturnValue([])
  vi.mocked(csvFileRepository.findByIds).mockReturnValue([])
  vi.mocked(pdfFileRepository.findByIds).mockReturnValue([])
  vi.mocked(imageFileRepository.findByIds).mockReturnValue([])
})

describe('findByCanvas', () => {
  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasNodeService.findByCanvas('bad')).toThrow(NotFoundError)
  })

  it('노드 없음 → 빈 배열', () => {
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result).toEqual([])
  })

  it('text 노드 — ref 필드 undefined', () => {
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([MOCK_NODE_ROW])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBeUndefined()
    expect(result[0].refPreview).toBeUndefined()
    expect(result[0].refMeta).toBeUndefined()
  })

  it('todo ref 노드 — refTitle, refPreview, refMeta 매핑', () => {
    const todoNode = { ...MOCK_NODE_ROW, type: 'todo' as const, refId: 'todo-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([todoNode])
    vi.mocked(todoRepository.findByIds).mockReturnValue([
      {
        id: 'todo-1',
        title: '할 일',
        description: '설명',
        isDone: false,
        status: '할일',
        priority: 'high',
        dueDate: null,
        startDate: null
      } as never
    ])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBe('할 일')
    expect(result[0].refPreview).toBe('설명')
    expect(result[0].refMeta).toEqual(
      expect.objectContaining({ isDone: false, status: '할일', priority: 'high' })
    )
  })

  it('note ref 노드 — preview 200자 제한', () => {
    const noteNode = { ...MOCK_NODE_ROW, type: 'note' as const, refId: 'note-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([noteNode])
    const longPreview = 'a'.repeat(300)
    vi.mocked(noteRepository.findByIds).mockReturnValue([
      { id: 'note-1', title: '노트', preview: longPreview } as never
    ])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBe('노트')
    expect(result[0].refPreview).toHaveLength(200)
  })

  it('schedule ref 노드 — refMeta 매핑', () => {
    const schedNode = { ...MOCK_NODE_ROW, type: 'schedule' as const, refId: 'sched-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([schedNode])
    vi.mocked(scheduleRepository.findByIds).mockReturnValue([
      {
        id: 'sched-1',
        title: '일정',
        description: '회의',
        location: '서울',
        allDay: false,
        startAt: new Date(),
        endAt: new Date(),
        color: 'blue',
        priority: 'high'
      } as never
    ])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBe('일정')
    expect(result[0].refMeta).toEqual(
      expect.objectContaining({ allDay: false, color: 'blue', location: '서울' })
    )
  })

  it('csv ref 노드 — refTitle, refPreview 매핑', () => {
    const csvNode = { ...MOCK_NODE_ROW, type: 'csv' as const, refId: 'csv-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([csvNode])
    vi.mocked(csvFileRepository.findByIds).mockReturnValue([
      { id: 'csv-1', title: 'data.csv', preview: '헤더,값' } as never
    ])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBe('data.csv')
    expect(result[0].refPreview).toBe('헤더,값')
  })

  it('pdf ref 노드 — refTitle, refPreview 매핑', () => {
    const pdfNode = { ...MOCK_NODE_ROW, type: 'pdf' as const, refId: 'pdf-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([pdfNode])
    vi.mocked(pdfFileRepository.findByIds).mockReturnValue([
      { id: 'pdf-1', title: 'doc.pdf', preview: '내용' } as never
    ])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBe('doc.pdf')
    expect(result[0].refPreview).toBe('내용')
  })

  it('image ref 노드 — description을 preview로 사용', () => {
    const imgNode = { ...MOCK_NODE_ROW, type: 'image' as const, refId: 'img-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([imgNode])
    vi.mocked(imageFileRepository.findByIds).mockReturnValue([
      { id: 'img-1', title: 'photo.png', description: '사진 설명' } as never
    ])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBe('photo.png')
    expect(result[0].refPreview).toBe('사진 설명')
  })

  it('refId 없는 ref 타입 — batchFetchRefs skip, ref 필드 undefined', () => {
    const nodeNoRef = { ...MOCK_NODE_ROW, type: 'todo' as const, refId: null }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([nodeNoRef])
    const result = canvasNodeService.findByCanvas('canvas-1')
    expect(result[0].refTitle).toBeUndefined()
    expect(todoRepository.findByIds).not.toHaveBeenCalled()
  })
})

describe('fetchRefData', () => {
  it('정상 — ref 데이터 Map 반환', () => {
    const todoNode = { ...MOCK_NODE_ROW, type: 'todo' as const, refId: 'todo-1' }
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([todoNode])
    vi.mocked(todoRepository.findByIds).mockReturnValue([
      { id: 'todo-1', title: '할일', description: '' } as never
    ])
    const result = canvasNodeService.fetchRefData('canvas-1')
    expect(result).toBeInstanceOf(Map)
    expect(result.get('todo-1')).toBeDefined()
  })

  it('노드 없음 — 빈 Map 반환 (NotFoundError 아님)', () => {
    vi.mocked(canvasNodeRepository.findByCanvasId).mockReturnValue([])
    // canvas 존재 확인 없음 — NotFoundError 발생하지 않음
    const result = canvasNodeService.fetchRefData('nonexistent')
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })
})

describe('create', () => {
  beforeEach(() => {
    vi.mocked(canvasNodeRepository.create).mockReturnValue(MOCK_NODE_ROW)
  })

  it('canvas 없음 → NotFoundError', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
    expect(() => canvasNodeService.create('bad', { type: 'text', x: 0, y: 0 })).toThrow(
      NotFoundError
    )
  })

  it('정상 (text) — defaults 확인', () => {
    canvasNodeService.create('canvas-1', { type: 'text', x: 0, y: 0 })
    expect(canvasNodeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-id',
        canvasId: 'canvas-1',
        type: 'text',
        refId: null,
        width: 260,
        height: 160,
        color: null,
        content: null,
        zIndex: 0
      })
    )
  })

  it('정상 (ref) — refId 전달됨', () => {
    canvasNodeService.create('canvas-1', { type: 'todo', refId: 'todo-1', x: 0, y: 0 })
    expect(canvasNodeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ refId: 'todo-1' })
    )
  })

  it('custom width/height — 전달값 사용', () => {
    canvasNodeService.create('canvas-1', {
      type: 'note',
      x: 0,
      y: 0,
      width: 400,
      height: 300
    })
    expect(canvasNodeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ width: 400, height: 300 })
    )
  })
})

describe('update', () => {
  beforeEach(() => {
    vi.mocked(canvasNodeRepository.findById).mockReturnValue(MOCK_NODE_ROW)
    vi.mocked(canvasNodeRepository.update).mockReturnValue(MOCK_NODE_ROW)
  })

  it('node 없음 (findById) → NotFoundError', () => {
    vi.mocked(canvasNodeRepository.findById).mockReturnValue(undefined)
    expect(() => canvasNodeService.update('bad', { content: 'x' })).toThrow(NotFoundError)
  })

  it('node 없음 (update 반환 undefined) → NotFoundError', () => {
    vi.mocked(canvasNodeRepository.update).mockReturnValue(undefined)
    expect(() => canvasNodeService.update('node-1', { content: 'x' })).toThrow(NotFoundError)
  })

  it('content만 변경 — updatedAt 설정', () => {
    canvasNodeService.update('node-1', { content: '수정' })
    expect(canvasNodeRepository.update).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({ content: '수정', updatedAt: expect.any(Date) })
    )
  })

  it('width + height 변경', () => {
    canvasNodeService.update('node-1', { width: 500, height: 400 })
    expect(canvasNodeRepository.update).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({ width: 500, height: 400 })
    )
  })
})

describe('updatePositions', () => {
  it('bulkUpdatePositions 직접 위임', () => {
    const updates = [{ id: 'n-1', x: 10, y: 20 }]
    canvasNodeService.updatePositions(updates)
    expect(canvasNodeRepository.bulkUpdatePositions).toHaveBeenCalledWith(updates)
  })
})

describe('remove', () => {
  it('node 없음 → NotFoundError', () => {
    vi.mocked(canvasNodeRepository.findById).mockReturnValue(undefined)
    expect(() => canvasNodeService.remove('bad')).toThrow(NotFoundError)
  })

  it('정상 — canvasNodeRepository.delete 호출', () => {
    vi.mocked(canvasNodeRepository.findById).mockReturnValue(MOCK_NODE_ROW)
    canvasNodeService.remove('node-1')
    expect(canvasNodeRepository.delete).toHaveBeenCalledWith('node-1')
  })
})
