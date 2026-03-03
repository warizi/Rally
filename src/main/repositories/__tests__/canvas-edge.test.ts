import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { canvasEdgeRepository, type CanvasEdgeInsert } from '../canvas-edge'

const WS_ID = 'ws-1'
const CANVAS_ID = 'canvas-1'
const NODE_A = 'node-a'
const NODE_B = 'node-b'

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
  testDb
    .insert(schema.canvases)
    .values({
      id: CANVAS_ID,
      workspaceId: WS_ID,
      title: 'Test Canvas',
      description: '',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
  testDb
    .insert(schema.canvasNodes)
    .values({
      id: NODE_A,
      canvasId: CANVAS_ID,
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
  testDb
    .insert(schema.canvasNodes)
    .values({
      id: NODE_B,
      canvasId: CANVAS_ID,
      type: 'text',
      x: 300,
      y: 0,
      width: 260,
      height: 160,
      zIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

function makeEdge(overrides?: Partial<CanvasEdgeInsert>): CanvasEdgeInsert {
  return {
    id: 'edge-1',
    canvasId: CANVAS_ID,
    fromNode: NODE_A,
    toNode: NODE_B,
    fromSide: 'right',
    toSide: 'left',
    label: null,
    color: null,
    style: 'solid',
    arrow: 'end',
    createdAt: new Date(),
    ...overrides
  }
}

describe('findByCanvasId', () => {
  it('엣지 없을 때 빈 배열 반환', () => {
    expect(canvasEdgeRepository.findByCanvasId(CANVAS_ID)).toEqual([])
  })

  it('엣지 여러 개 반환', () => {
    testDb.insert(schema.canvasEdges).values(makeEdge({ id: 'e-1' })).run()
    testDb
      .insert(schema.canvasEdges)
      .values(makeEdge({ id: 'e-2', fromNode: NODE_B, toNode: NODE_A }))
      .run()
    const result = canvasEdgeRepository.findByCanvasId(CANVAS_ID)
    expect(result).toHaveLength(2)
  })
})

describe('findById', () => {
  it('존재하는 id → CanvasEdge 반환', () => {
    testDb.insert(schema.canvasEdges).values(makeEdge()).run()
    const result = canvasEdgeRepository.findById('edge-1')
    expect(result).toBeDefined()
    expect(result!.fromNode).toBe(NODE_A)
    expect(result!.toNode).toBe(NODE_B)
  })

  it('없는 id → undefined', () => {
    expect(canvasEdgeRepository.findById('nonexistent')).toBeUndefined()
  })
})

describe('create', () => {
  it('모든 필드 반환값 검증', () => {
    const result = canvasEdgeRepository.create(makeEdge())
    expect(result.id).toBe('edge-1')
    expect(result.canvasId).toBe(CANVAS_ID)
    expect(result.fromNode).toBe(NODE_A)
    expect(result.toNode).toBe(NODE_B)
    expect(result.fromSide).toBe('right')
    expect(result.toSide).toBe('left')
    expect(result.label).toBeNull()
    expect(result.color).toBeNull()
    expect(result.style).toBe('solid')
    expect(result.arrow).toBe('end')
    expect(result.createdAt).toBeDefined()
  })
})

describe('update', () => {
  beforeEach(() => {
    testDb.insert(schema.canvasEdges).values(makeEdge()).run()
  })

  it('style만 변경 — 나머지 보존', () => {
    const result = canvasEdgeRepository.update('edge-1', { style: 'dashed' })
    expect(result).toBeDefined()
    expect(result!.style).toBe('dashed')
    expect(result!.fromSide).toBe('right')
    expect(result!.arrow).toBe('end')
  })

  it('없는 id → undefined', () => {
    expect(canvasEdgeRepository.update('nonexistent', { style: 'dotted' })).toBeUndefined()
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb.insert(schema.canvasEdges).values(makeEdge()).run()
    canvasEdgeRepository.delete('edge-1')
    expect(canvasEdgeRepository.findById('edge-1')).toBeUndefined()
  })
})
