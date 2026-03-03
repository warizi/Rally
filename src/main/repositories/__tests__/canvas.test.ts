import { describe, expect, it, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { canvasRepository, type CanvasInsert } from '../canvas'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test',
      path: '/test',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

function makeCanvas(overrides?: Partial<CanvasInsert>): CanvasInsert {
  return {
    id: 'canvas-1',
    workspaceId: WS_ID,
    title: 'Test Canvas',
    description: '',
    viewportX: 0,
    viewportY: 0,
    viewportZoom: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

describe('findByWorkspaceId', () => {
  it('캔버스 없을 때 빈 배열 반환', () => {
    expect(canvasRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('캔버스 여러 개 반환', () => {
    testDb.insert(schema.canvases).values(makeCanvas({ id: 'c-1' })).run()
    testDb.insert(schema.canvases).values(makeCanvas({ id: 'c-2' })).run()
    const result = canvasRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(2)
  })

  it('다른 워크스페이스 캔버스 배제', () => {
    testDb
      .insert(schema.workspaces)
      .values({
        id: 'ws-other',
        name: 'Other',
        path: '/other',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()
    testDb.insert(schema.canvases).values(makeCanvas({ id: 'c-1' })).run()
    testDb
      .insert(schema.canvases)
      .values(makeCanvas({ id: 'c-other', workspaceId: 'ws-other' }))
      .run()
    const result = canvasRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c-1')
  })
})

describe('findById', () => {
  it('존재하는 id → Canvas 반환', () => {
    testDb.insert(schema.canvases).values(makeCanvas()).run()
    const result = canvasRepository.findById('canvas-1')
    expect(result).toBeDefined()
    expect(result!.title).toBe('Test Canvas')
  })

  it('없는 id → undefined', () => {
    expect(canvasRepository.findById('nonexistent')).toBeUndefined()
  })
})

describe('create', () => {
  it('모든 필드 반환값 검증', () => {
    const result = canvasRepository.create(makeCanvas())
    expect(result.id).toBe('canvas-1')
    expect(result.workspaceId).toBe(WS_ID)
    expect(result.title).toBe('Test Canvas')
    expect(result.description).toBe('')
    expect(result.viewportX).toBe(0)
    expect(result.viewportY).toBe(0)
    expect(result.viewportZoom).toBe(1)
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })
})

describe('update', () => {
  beforeEach(() => {
    testDb.insert(schema.canvases).values(makeCanvas()).run()
  })

  it('title만 변경 — 나머지 보존', () => {
    const result = canvasRepository.update('canvas-1', {
      title: '새 제목',
      updatedAt: new Date()
    })
    expect(result).toBeDefined()
    expect(result!.title).toBe('새 제목')
    expect(result!.description).toBe('')
    expect(result!.viewportX).toBe(0)
  })

  it('없는 id → undefined', () => {
    expect(canvasRepository.update('nonexistent', { title: 'x' })).toBeUndefined()
  })
})

describe('updateViewport', () => {
  beforeEach(() => {
    testDb.insert(schema.canvases).values(makeCanvas()).run()
  })

  it('viewport 변경 — 기타 필드 불변', () => {
    canvasRepository.updateViewport('canvas-1', {
      viewportX: 100,
      viewportY: 200,
      viewportZoom: 1.5
    })
    const result = canvasRepository.findById('canvas-1')
    expect(result!.viewportX).toBe(100)
    expect(result!.viewportY).toBe(200)
    expect(result!.viewportZoom).toBe(1.5)
    expect(result!.title).toBe('Test Canvas')
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb.insert(schema.canvases).values(makeCanvas()).run()
    canvasRepository.delete('canvas-1')
    expect(canvasRepository.findById('canvas-1')).toBeUndefined()
  })

  it('cascade — canvas 삭제 시 소속 node도 삭제', () => {
    testDb.insert(schema.canvases).values(makeCanvas()).run()
    testDb
      .insert(schema.canvasNodes)
      .values({
        id: 'node-1',
        canvasId: 'canvas-1',
        type: 'text',
        x: 0,
        y: 0,
        width: 260,
        height: 160,
        zIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()
    canvasRepository.delete('canvas-1')
    const nodes = testDb
      .select()
      .from(schema.canvasNodes)
      .where(eq(schema.canvasNodes.canvasId, 'canvas-1'))
      .all()
    expect(nodes).toHaveLength(0)
  })
})
