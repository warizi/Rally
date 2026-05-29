/**
 * widgets/canvas/model/node-type-registry.test.ts
 *
 * 노드 type → config 매핑 + PICKABLE_TYPES 필터.
 */
import { describe, it, expect } from 'vitest'
import { NODE_TYPE_REGISTRY, PICKABLE_TYPES } from '../node-type-registry'

describe('NODE_TYPE_REGISTRY', () => {
  it('8개 노드 type 정의 (text/todo/note/schedule/csv/pdf/image/canvas)', () => {
    expect(Object.keys(NODE_TYPE_REGISTRY).sort()).toEqual([
      'canvas',
      'csv',
      'image',
      'note',
      'pdf',
      'schedule',
      'text',
      'todo'
    ])
  })

  it('text 는 component=null (전용 컴포넌트 없음)', () => {
    expect(NODE_TYPE_REGISTRY.text.component).toBe(null)
    expect(NODE_TYPE_REGISTRY.text.pickable).toBe(false)
  })

  it('todo/note/csv 등은 component 필수', () => {
    for (const key of ['todo', 'note', 'csv', 'pdf', 'image', 'canvas', 'schedule'] as const) {
      expect(NODE_TYPE_REGISTRY[key].component).not.toBeNull()
    }
  })

  it('schedule 은 resizable=false', () => {
    expect(NODE_TYPE_REGISTRY.schedule.resizable).toBe(false)
  })

  it('모든 config 는 defaultWidth / defaultHeight 양수', () => {
    for (const config of Object.values(NODE_TYPE_REGISTRY)) {
      expect(config.defaultWidth).toBeGreaterThan(0)
      expect(config.defaultHeight).toBeGreaterThan(0)
    }
  })
})

describe('PICKABLE_TYPES', () => {
  it('text 제외 — pickable=true 만', () => {
    const types = PICKABLE_TYPES.map((p) => p.type)
    expect(types).not.toContain('text')
    expect(types.sort()).toEqual(['canvas', 'csv', 'image', 'note', 'pdf', 'schedule', 'todo'])
  })

  it('각 항목은 type/icon/label 포함', () => {
    for (const p of PICKABLE_TYPES) {
      expect(p.type).toBeDefined()
      expect(p.icon).toBeDefined()
      expect(typeof p.label).toBe('string')
    }
  })
})
