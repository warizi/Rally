/**
 * tool-definitions 무결성 회귀 차단 테스트.
 *
 * P3-7 — 1,031L 단일 파일을 13개 도메인 파일로 분할. 등록 누락 / 중복 / 이름 형식
 * 깨짐을 자동 감지.
 *
 * MCP v2 마이그레이션 진행 중 — baseline 은 신규 도구 추가 시마다 증가한다.
 * v2 신규: browse, read, read_workspace, manage_tasks (+4).
 */
import { describe, it, expect } from 'vitest'
import { allTools } from '../index'

const BASELINE_TOOL_COUNT = 33

describe('tool-definitions 무결성', () => {
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

  it('필수 핵심 tool 이 모두 존재한다', () => {
    const names = new Set(allTools.map((t) => t.name))
    const required = [
      'list_items',
      'search',
      'read_contents',
      'write_content',
      'manage_items',
      'manage_folders',
      'list_todos',
      'manage_todos',
      'read_canvas',
      'create_canvas',
      'edit_canvas',
      'get_workspace_info',
      'list_trash',
      'manage_trash',
      // v2
      'browse',
      'read',
      'read_workspace',
      'manage_tasks'
    ]
    for (const name of required) {
      expect(names.has(name), `missing required tool: ${name}`).toBe(true)
    }
  })

  it('domain prefix 별 카운트 (구조적 회귀)', () => {
    const counts = {
      list_: 0,
      manage_: 0,
      read_: 0,
      write_: 0,
      create_: 0,
      edit_: 0,
      get_: 0,
      search: 0
    }
    for (const tool of allTools) {
      if (tool.name.startsWith('list_')) counts.list_++
      else if (tool.name.startsWith('manage_')) counts.manage_++
      else if (tool.name.startsWith('read_')) counts.read_++
      else if (tool.name.startsWith('write_')) counts.write_++
      else if (tool.name.startsWith('create_')) counts.create_++
      else if (tool.name.startsWith('edit_')) counts.edit_++
      else if (tool.name.startsWith('get_')) counts.get_++
      else if (tool.name === 'search') counts.search++
    }
    // 분할 후에도 prefix 카운트 동일 — 누락 감지용
    expect(counts.list_).toBeGreaterThanOrEqual(8) // list_items / files / todos 등
    expect(counts.manage_).toBeGreaterThanOrEqual(10)
    expect(counts.get_).toBeGreaterThanOrEqual(2) // get_history / get_workspace_info
  })
})
