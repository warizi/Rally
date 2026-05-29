/**
 * entities/skill/lib/rally-tools.test.ts
 *
 * RALLY_TOOLS 카탈로그 + getToolLabel / isKnownTool.
 */
import { describe, it, expect } from 'vitest'
import { RALLY_TOOLS, getToolLabel, isKnownTool } from '../rally-tools'

describe('RALLY_TOOLS', () => {
  it('17개 도구 정의 (현행 카탈로그)', () => {
    expect(RALLY_TOOLS).toHaveLength(17)
  })

  it('각 항목은 value/label/description 필수', () => {
    for (const t of RALLY_TOOLS) {
      expect(typeof t.value).toBe('string')
      expect(t.value.length).toBeGreaterThan(0)
      expect(typeof t.label).toBe('string')
      expect(typeof t.description).toBe('string')
    }
  })

  it('value 는 mcp__rally__ 접두사 없음 (raw 함수명)', () => {
    for (const t of RALLY_TOOLS) {
      expect(t.value).not.toMatch(/^mcp__rally__/)
    }
  })

  it('읽기/쓰기 일부 핵심 도구 포함', () => {
    const values = RALLY_TOOLS.map((t) => t.value)
    for (const v of ['read', 'search', 'browse', 'manage_content', 'manage_tasks']) {
      expect(values).toContain(v)
    }
  })
})

describe('getToolLabel', () => {
  it('알려진 value → label 반환', () => {
    expect(getToolLabel('read')).toBe('아이템 읽기')
    expect(getToolLabel('manage_tasks')).toBe('할일·일정·반복 관리')
  })

  it('알려지지 않은 value → value 그대로 반환 (fallback)', () => {
    expect(getToolLabel('phantom-tool')).toBe('phantom-tool')
  })
})

describe('isKnownTool', () => {
  it('알려진 value → true', () => {
    expect(isKnownTool('search')).toBe(true)
  })

  it('알려지지 않은 value → false', () => {
    expect(isKnownTool('phantom-tool')).toBe(false)
  })

  it('빈 문자열 → false', () => {
    expect(isKnownTool('')).toBe(false)
  })
})
