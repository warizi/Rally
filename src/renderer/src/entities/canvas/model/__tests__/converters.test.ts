import { describe, it, expect } from 'vitest'
import { toReactFlowNode, toReactFlowEdge, parseSide, toCreateCanvasEdgeData } from '../converters'
import type { CanvasNodeItem, CanvasEdgeItem } from '../types'

function makeNodeItem(overrides: Partial<CanvasNodeItem> = {}): CanvasNodeItem {
  return {
    id: 'node-1',
    canvasId: 'canvas-1',
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

function makeEdgeItem(overrides: Partial<CanvasEdgeItem> = {}): CanvasEdgeItem {
  return {
    id: 'edge-1',
    canvasId: 'canvas-1',
    fromNode: 'node-1',
    toNode: 'node-2',
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

describe('toReactFlowNode', () => {
  it('text 타입 → type: textNode, data.nodeType: text', () => {
    const result = toReactFlowNode(makeNodeItem({ type: 'text' }))
    expect(result.type).toBe('textNode')
    expect(result.data.nodeType).toBe('text')
  })

  it('ref 타입 (todo) → type: refNode, data.nodeType: todo', () => {
    const result = toReactFlowNode(
      makeNodeItem({ type: 'todo', refId: 'ref-1', refTitle: '할 일 제목' })
    )
    expect(result.type).toBe('refNode')
    expect(result.data.nodeType).toBe('todo')
  })

  it('refTitle 있을 때 → data.label = refTitle', () => {
    const result = toReactFlowNode(
      makeNodeItem({ type: 'note', refTitle: '노트 제목', content: '내용' })
    )
    expect(result.data.label).toBe('노트 제목')
  })

  it('refTitle 없을 때 → data.label = content fallback', () => {
    const result = toReactFlowNode(makeNodeItem({ type: 'text', content: '텍스트 내용' }))
    expect(result.data.label).toBe('텍스트 내용')
  })

  it('content도 없을 때 → data.label = 빈 문자열', () => {
    const result = toReactFlowNode(makeNodeItem({ type: 'text', content: null }))
    expect(result.data.label).toBe('')
  })

  it('style.width/height → DB width/height 반영', () => {
    const result = toReactFlowNode(makeNodeItem({ width: 300, height: 400 }))
    expect(result.style).toEqual({ width: 300, height: 400 })
  })

  it('zIndex → 그대로 전달', () => {
    const result = toReactFlowNode(makeNodeItem({ zIndex: 5 }))
    expect(result.zIndex).toBe(5)
  })

  it('position → x, y 반영', () => {
    const result = toReactFlowNode(makeNodeItem({ x: 50, y: 75 }))
    expect(result.position).toEqual({ x: 50, y: 75 })
  })
})

describe('toReactFlowEdge', () => {
  it('style: solid → strokeDasharray: undefined', () => {
    const result = toReactFlowEdge(makeEdgeItem({ style: 'solid' }))
    expect(result.style?.strokeDasharray).toBeUndefined()
  })

  it('style: dashed → strokeDasharray: 5 5', () => {
    const result = toReactFlowEdge(makeEdgeItem({ style: 'dashed' }))
    expect(result.style?.strokeDasharray).toBe('5 5')
  })

  it('style: dotted → strokeDasharray: 2 2', () => {
    const result = toReactFlowEdge(makeEdgeItem({ style: 'dotted' }))
    expect(result.style?.strokeDasharray).toBe('2 2')
  })

  it('arrow: none → markerEnd: undefined', () => {
    const result = toReactFlowEdge(makeEdgeItem({ arrow: 'none' }))
    expect(result.markerEnd).toBeUndefined()
  })

  it('arrow: end → markerEnd 있음, markerStart: undefined', () => {
    const result = toReactFlowEdge(makeEdgeItem({ arrow: 'end' }))
    expect(result.markerEnd).toBeDefined()
    expect(result.markerStart).toBeUndefined()
  })

  it('arrow: both → markerEnd + markerStart 모두 있음', () => {
    const result = toReactFlowEdge(makeEdgeItem({ arrow: 'both' }))
    expect(result.markerEnd).toBeDefined()
    expect(result.markerStart).toBeDefined()
  })

  it('color → style.stroke 매핑', () => {
    const result = toReactFlowEdge(makeEdgeItem({ color: '#ff0000' }))
    expect(result.style?.stroke).toBe('#ff0000')
  })

  it('data 필드 매핑', () => {
    const result = toReactFlowEdge(
      makeEdgeItem({ style: 'dashed', arrow: 'both', color: '#00ff00' })
    )
    expect(result.data).toEqual({
      edgeStyle: 'dashed',
      arrow: 'both',
      color: '#00ff00',
      fromSide: 'right',
      toSide: 'left'
    })
  })
})

describe('parseSide', () => {
  it("'right-source' → 'right'", () => {
    expect(parseSide('right-source')).toBe('right')
  })

  it("'top-target' → 'top'", () => {
    expect(parseSide('top-target')).toBe('top')
  })

  it("'bottom' → 'bottom'", () => {
    expect(parseSide('bottom')).toBe('bottom')
  })

  it("null → 'right' (기본값)", () => {
    expect(parseSide(null)).toBe('right')
  })

  it("undefined → 'right' (기본값)", () => {
    expect(parseSide(undefined)).toBe('right')
  })
})

describe('toCreateCanvasEdgeData', () => {
  it('source/target → fromNode/toNode', () => {
    const result = toCreateCanvasEdgeData({
      source: 'node-a',
      target: 'node-b',
      sourceHandle: 'top-source',
      targetHandle: 'bottom-target'
    })
    expect(result.fromNode).toBe('node-a')
    expect(result.toNode).toBe('node-b')
  })

  it('sourceHandle/targetHandle → fromSide/toSide (suffix 제거)', () => {
    const result = toCreateCanvasEdgeData({
      source: 'node-a',
      target: 'node-b',
      sourceHandle: 'left-source',
      targetHandle: 'right-target'
    })
    expect(result.fromSide).toBe('left')
    expect(result.toSide).toBe('right')
  })

  it('handle 없으면 기본값 right', () => {
    const result = toCreateCanvasEdgeData({
      source: 'node-a',
      target: 'node-b'
    })
    expect(result.fromSide).toBe('right')
    expect(result.toSide).toBe('right')
  })
})
