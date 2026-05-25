import { describe, it, expect, beforeEach } from 'vitest'

import { skillService, SYSTEM_SKILL_NAMES, seedSystemSkills } from '../skill'
import { SYSTEM_SKILL_SEEDS } from '../system-skills-seed'
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors'

beforeEach(() => {
  // resetAllTables (test setup) 가 system_skills 도 비우므로 매 테스트마다 재seed.
  seedSystemSkills()
})

describe('seedSystemSkills', () => {
  it('빈 DB 에 SYSTEM_SKILL_NAMES 개수만큼 row 생성', () => {
    const list = skillService.list().filter((s) => s.source === 'system')
    expect(list).toHaveLength(SYSTEM_SKILL_NAMES.length)
  })

  it('이미 seed 된 상태에서 재호출해도 사용자 수정값을 덮어쓰지 않음 (idempotent)', () => {
    skillService.update('system:rally', {
      content: '---\nname: rally\ndescription: edited\n---\nedited'
    })
    seedSystemSkills()
    const fresh = skillService.get('system:rally')
    expect(fresh.content).toContain('edited')
    expect(fresh.hasOverride).toBe(true)
  })
})

describe('skillService.list', () => {
  it('system skill N개 + custom skill 통합 반환', () => {
    skillService.create({
      name: 'rally-my-skill',
      description: 'my desc',
      content: '---\nname: rally-my-skill\ndescription: my desc\n---\nbody'
    })
    const list = skillService.list()
    expect(list.filter((s) => s.source === 'system')).toHaveLength(SYSTEM_SKILL_NAMES.length)
    expect(list.filter((s) => s.source === 'custom')).toHaveLength(1)
    const sys = list.find((s) => s.name === 'rally')
    // seed 직후엔 default 값과 동일하므로 hasOverride=false.
    expect(sys?.editable).toBe(true)
    expect(sys?.hasOverride).toBe(false)
    expect(sys?.id).toBe('system:rally')
    // description 은 seed frontmatter 의 description 블록에서 파싱.
    expect(sys?.description.length).toBeGreaterThan(0)
  })

  it('system skill 순서는 SYSTEM_SKILL_NAMES 정의 순서와 동일', () => {
    const systemNames = skillService
      .list()
      .filter((s) => s.source === 'system')
      .map((s) => s.name)
    expect(systemNames).toEqual([...SYSTEM_SKILL_NAMES])
  })
})

describe('skillService.create', () => {
  const base = {
    description: 'desc',
    content: '---\nname: x\ndescription: d\n---\nbody'
  }

  it('정상 생성 후 list 조회 가능 (rally- prefix)', () => {
    const created = skillService.create({ name: 'rally-my-tool', ...base })
    expect(created.source).toBe('custom')
    expect(created.editable).toBe(true)
    expect(created.mcpTools).toEqual([])
    expect(created.triggers).toEqual([])
    expect(skillService.list().some((s) => s.id === created.id)).toBe(true)
  })

  it('mcpTools / triggers 배열을 영속화', () => {
    const created = skillService.create({
      name: 'rally-has-tools',
      ...base,
      mcpTools: ['read', 'browse'],
      triggers: ['foo', 'bar']
    })
    expect(created.mcpTools).toEqual(['read', 'browse'])
    expect(created.triggers).toEqual(['foo', 'bar'])
    const fetched = skillService.get(created.id)
    expect(fetched.mcpTools).toEqual(['read', 'browse'])
  })

  it('빈 이름은 ValidationError', () => {
    expect(() => skillService.create({ name: '   ', ...base })).toThrow(ValidationError)
  })

  it('잘못된 이름 패턴은 ValidationError (대문자/공백/한글 등)', () => {
    expect(() => skillService.create({ name: 'rally-MySkill', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: 'rally-my skill', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: 'rally-내스킬', ...base })).toThrow(ValidationError)
  })

  it("'rally-' prefix 없으면 ValidationError", () => {
    expect(() => skillService.create({ name: 'my-tool', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: 'plain-name', ...base })).toThrow(ValidationError)
  })

  it("'rally-' 만 입력하면 ValidationError (suffix 필요)", () => {
    expect(() => skillService.create({ name: 'rally-', ...base })).toThrow(ValidationError)
  })

  it('system skill 과 이름 충돌은 ValidationError (RESERVED)', () => {
    expect(() => skillService.create({ name: 'rally', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: 'rally-do', ...base })).toThrow(ValidationError)
  })

  it('동일 커스텀 이름 중복은 ConflictError', () => {
    skillService.create({ name: 'rally-dup', ...base })
    expect(() => skillService.create({ name: 'rally-dup', ...base })).toThrow(ConflictError)
  })
})

describe('skillService.update', () => {
  it('description/content/mcpTools 부분 업데이트', () => {
    const created = skillService.create({
      name: 'rally-editable',
      description: 'before',
      content: 'before-content'
    })
    const updated = skillService.update(created.id, {
      description: 'after',
      mcpTools: ['x']
    })
    expect(updated.description).toBe('after')
    expect(updated.content).toBe('before-content')
    expect(updated.mcpTools).toEqual(['x'])
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime())
  })

  it('system skill content/mcpTools 수정은 row 갱신 + hasOverride=true', () => {
    const updated = skillService.update('system:rally', {
      content: '---\nname: rally\ndescription: edited\n---\nedited body',
      mcpTools: ['read', 'browse']
    })
    expect(updated.source).toBe('system')
    expect(updated.hasOverride).toBe(true)
    expect(updated.content).toContain('edited body')
    expect(updated.mcpTools).toEqual(['read', 'browse'])
  })

  it('system skill resetSystem 으로 default 복원 → hasOverride=false', () => {
    skillService.update('system:rally', {
      content: '---\nname: rally\ndescription: edited\n---\nedited body',
      mcpTools: ['read']
    })
    const reset = skillService.resetSystem('system:rally')
    expect(reset.hasOverride).toBe(false)
    expect(reset.mcpTools).toEqual([])
    const seed = SYSTEM_SKILL_SEEDS.find((s) => s.name === 'rally')!
    expect(reset.content).toBe(seed.content)
  })

  it('존재하지 않는 id 는 NotFoundError', () => {
    expect(() => skillService.update('non-existent', { description: 'x' })).toThrow(NotFoundError)
  })
})

describe('skillService.ensureCustomDeletable (trash 위임 가드)', () => {
  it('활성 커스텀 skill 의 name 회수', () => {
    const created = skillService.create({
      name: 'rally-deletable',
      description: 'd',
      content: 'c'
    })
    expect(skillService.ensureCustomDeletable(created.id)).toEqual({ name: 'rally-deletable' })
  })

  it('system skill 삭제는 ValidationError', () => {
    expect(() => skillService.ensureCustomDeletable('system:rally')).toThrow(ValidationError)
  })

  it('없는 id 는 NotFoundError', () => {
    expect(() => skillService.ensureCustomDeletable('nope')).toThrow(NotFoundError)
  })
})

describe('skillService.get', () => {
  it('system: 접두사로 system skill 조회', () => {
    const got = skillService.get('system:rally-do')
    expect(got.source).toBe('system')
    expect(got.editable).toBe(true)
    expect(got.name).toBe('rally-do')
  })

  it('seed 되지 않은 system 이름은 NotFoundError', () => {
    expect(() => skillService.get('system:unknown-skill')).toThrow(NotFoundError)
  })
})
