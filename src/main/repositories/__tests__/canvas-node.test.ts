import { describe, expect, it, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { canvasNodeRepository, type CanvasNodeInsert } from '../canvas-node'

const WS_ID = 'ws-1'
const CANVAS_ID = 'canvas-1'

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
})

function makeNode(overrides?: Partial<CanvasNodeInsert>): CanvasNodeInsert {
  return {
    id: 'node-1',
    canvasId: CANVAS_ID,
    type: 'text',
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
    ...overrides
  }
}

describe('findByCanvasId', () => {
  it('노드 없을 때 빈 배열 반환', () => {
    expect(canvasNodeRepository.findByCanvasId(CANVAS_ID)).toEqual([])
  })

  it('노드 여러 개 반환', () => {
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-1' }))
      .run()
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-2' }))
      .run()
    const result = canvasNodeRepository.findByCanvasId(CANVAS_ID)
    expect(result).toHaveLength(2)
  })
})

describe('findById', () => {
  it('존재하는 id → CanvasNode 반환', () => {
    testDb.insert(schema.canvasNodes).values(makeNode()).run()
    const result = canvasNodeRepository.findById('node-1')
    expect(result).toBeDefined()
    expect(result!.type).toBe('text')
  })

  it('없는 id → undefined', () => {
    expect(canvasNodeRepository.findById('nonexistent')).toBeUndefined()
  })
})

describe('findByIds', () => {
  it('빈 배열 → []', () => {
    expect(canvasNodeRepository.findByIds([])).toEqual([])
  })

  it('정상 — 2개 ID 조회', () => {
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-1' }))
      .run()
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-2' }))
      .run()
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-3' }))
      .run()
    const result = canvasNodeRepository.findByIds(['n-1', 'n-3'])
    expect(result).toHaveLength(2)
    const ids = result.map((n) => n.id).sort()
    expect(ids).toEqual(['n-1', 'n-3'])
  })
})

describe('create', () => {
  it('모든 필드 반환값 검증', () => {
    const result = canvasNodeRepository.create(makeNode())
    expect(result.id).toBe('node-1')
    expect(result.canvasId).toBe(CANVAS_ID)
    expect(result.type).toBe('text')
    expect(result.refId).toBeNull()
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
    expect(result.width).toBe(260)
    expect(result.height).toBe(160)
    expect(result.color).toBeNull()
    expect(result.content).toBe('hello')
    expect(result.zIndex).toBe(0)
  })
})

describe('update', () => {
  beforeEach(() => {
    testDb.insert(schema.canvasNodes).values(makeNode()).run()
  })

  it('content만 변경 — 나머지 보존', () => {
    const result = canvasNodeRepository.update('node-1', {
      content: '수정됨',
      updatedAt: new Date()
    })
    expect(result).toBeDefined()
    expect(result!.content).toBe('수정됨')
    expect(result!.x).toBe(100)
    expect(result!.y).toBe(200)
  })

  it('없는 id → undefined', () => {
    expect(canvasNodeRepository.update('nonexistent', { content: 'x' })).toBeUndefined()
  })
})

describe('bulkUpdatePositions', () => {
  it('빈 배열 → no-op', () => {
    testDb.insert(schema.canvasNodes).values(makeNode()).run()
    const before = canvasNodeRepository.findById('node-1')
    canvasNodeRepository.bulkUpdatePositions([])
    const after = canvasNodeRepository.findById('node-1')
    expect(after!.x).toBe(before!.x)
    expect(after!.y).toBe(before!.y)
  })

  it('여러 노드 position 변경 + updatedAt 갱신', () => {
    const earlyDate = new Date('2020-01-01')
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-1', x: 0, y: 0, createdAt: earlyDate, updatedAt: earlyDate }))
      .run()
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-2', x: 0, y: 0, createdAt: earlyDate, updatedAt: earlyDate }))
      .run()

    canvasNodeRepository.bulkUpdatePositions([
      { id: 'n-1', x: 300, y: 400 },
      { id: 'n-2', x: 500, y: 600 }
    ])

    const n1 = canvasNodeRepository.findById('n-1')
    const n2 = canvasNodeRepository.findById('n-2')
    expect(n1!.x).toBe(300)
    expect(n1!.y).toBe(400)
    expect(n2!.x).toBe(500)
    expect(n2!.y).toBe(600)
    // updatedAt이 earlyDate 이후로 갱신됨
    expect(n1!.updatedAt.getTime()).toBeGreaterThan(earlyDate.getTime())
    expect(n2!.updatedAt.getTime()).toBeGreaterThan(earlyDate.getTime())
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb.insert(schema.canvasNodes).values(makeNode()).run()
    canvasNodeRepository.delete('node-1')
    expect(canvasNodeRepository.findById('node-1')).toBeUndefined()
  })

  it('FK cascade — 노드 삭제 시 연결된 edge도 삭제', () => {
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-a' }))
      .run()
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-b' }))
      .run()
    testDb
      .insert(schema.canvasEdges)
      .values({
        id: 'edge-1',
        canvasId: CANVAS_ID,
        fromNode: 'n-a',
        toNode: 'n-b',
        fromSide: 'right',
        toSide: 'left',
        style: 'solid',
        arrow: 'end',
        createdAt: new Date()
      })
      .run()
    canvasNodeRepository.delete('n-a')
    const edges = testDb
      .select()
      .from(schema.canvasEdges)
      .where(eq(schema.canvasEdges.id, 'edge-1'))
      .all()
    expect(edges).toHaveLength(0)
  })
})

describe('deleteByRef', () => {
  it('해당 type + refId 노드만 삭제', () => {
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-todo', type: 'todo', refId: 'ref-1' }))
      .run()
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-text' }))
      .run()
    canvasNodeRepository.deleteByRef('todo', 'ref-1')
    expect(canvasNodeRepository.findById('n-todo')).toBeUndefined()
    expect(canvasNodeRepository.findById('n-text')).toBeDefined()
  })

  it('같은 refId지만 다른 type → 삭제 안 됨', () => {
    testDb
      .insert(schema.canvasNodes)
      .values(makeNode({ id: 'n-note', type: 'note', refId: 'ref-1' }))
      .run()
    canvasNodeRepository.deleteByRef('todo', 'ref-1')
    expect(canvasNodeRepository.findById('n-note')).toBeDefined()
  })
})
