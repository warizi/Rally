/**
 * tool-definitions 무결성 회귀 차단 테스트.
 *
 * P3-7 — 1,031L 단일 파일을 13개 도메인 파일로 분할. 등록 누락 / 중복 / 이름 형식
 * 깨짐을 자동 감지.
 *
 * MCP v2 완료 — v1 도구 제거 후 16개 도구 (read_* / manage_* / search + read_note_image).
 * + manage_workspace 추가 → 17개.
 */
import { describe, it, expect } from 'vitest'
import { allTools } from '../index'

const BASELINE_TOOL_COUNT = 17

const V2_TOOLS = [
  // Discovery (3)
  'search',
  'browse',
  'read_workspace',
  // Read content (5)
  'read',
  'read_tasks',
  'read_trash',
  'read_templates',
  'read_note_image',
  // Manage content (3)
  'manage_content',
  'manage_canvas',
  'manage_templates',
  // Manage work (1)
  'manage_tasks',
  // Manage organize (4)
  'manage_items',
  'manage_links',
  'manage_tags',
  'manage_trash',
  // Manage workspace (1)
  'manage_workspace'
] as const

describe('tool-definitions 무결성 (v2 final)', () => {
  it('전체 tool 개수가 baseline 과 동일', () => {
    expect(allTools.length).toBe(BASELINE_TOOL_COUNT)
  })

  it('모든 tool 이름이 고유 (중복 없음)', () => {
    const names = allTools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('모든 tool 이름은 [a-z_] 만 사용 (snake_case)', () => {
    for (const tool of allTools) {
      expect(tool.name, `invalid name: ${tool.name}`).toMatch(/^[a-z_]+$/)
    }
  })

  it('모든 tool 이 description / schema / handler 를 갖춘다', () => {
    for (const tool of allTools) {
      expect(tool.description.length, `${tool.name}: empty description`).toBeGreaterThan(0)
      expect(tool.schema, `${tool.name}: missing schema`).toBeDefined()
      expect(typeof tool.handler, `${tool.name}: handler not function`).toBe('function')
    }
  })

  it('v2 최종 도구 16개가 모두 존재한다', () => {
    const names = new Set(allTools.map((t) => t.name))
    for (const name of V2_TOOLS) {
      expect(names.has(name), `missing v2 tool: ${name}`).toBe(true)
    }
  })

  it('v1 deprecated 도구는 모두 제거됨', () => {
    const names = new Set(allTools.map((t) => t.name))
    const removed = [
      'list_items',
      'list_files',
      'list_tagged_items',
      'list_tags',
      'list_todos',
      'list_schedules',
      'list_reminders',
      'list_recurring_rules',
      'list_trash',
      'list_templates',
      'read_contents',
      'read_canvas',
      'write_content',
      'manage_folders',
      'manage_files',
      'create_canvas',
      'edit_canvas',
      'manage_todos',
      'manage_schedules',
      'manage_reminders',
      'manage_recurring_rules',
      'get_history',
      'get_workspace_info'
    ]
    for (const name of removed) {
      expect(names.has(name), `v1 tool '${name}' should have been removed`).toBe(false)
    }
  })

  it('남은 도구는 모두 read*/manage* prefix 또는 prominent 단일 단어', () => {
    // search / browse / read 는 v2 prominent 도구로 짧은 단일 단어 이름 사용
    const standalone = new Set(['search', 'browse', 'read'])
    for (const tool of allTools) {
      const validName =
        standalone.has(tool.name) ||
        tool.name.startsWith('read_') ||
        tool.name.startsWith('manage_')
      expect(
        validName,
        `${tool.name} 은 read/read_*/manage_*/search/browse 중 하나여야 함`
      ).toBe(true)
    }
  })

  it('어떤 도구도 deprecated 가 아니다 (v1 모두 제거됨)', () => {
    for (const tool of allTools) {
      expect(tool.deprecated, `${tool.name} 이 아직 deprecated 마킹되어 있음`).toBeUndefined()
    }
  })
})
