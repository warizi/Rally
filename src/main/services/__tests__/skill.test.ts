import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import { skillService, SYSTEM_SKILL_NAMES } from '../skill'
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors'

let tmpRoot: string

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'rally-skills-test-'))
  // 번들된 system skill 디렉터리를 임시 경로로 우회시키기 위해 process.cwd 를 mock.
  // is.dev 가 true 이면 service 가 process.cwd()/.claude/skills 를 사용.
  vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot)
  const skillsRoot = join(tmpRoot, '.claude', 'skills')
  for (const name of SYSTEM_SKILL_NAMES) {
    const dir = join(skillsRoot, name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: |\n  System skill ${name} description.\n---\n\n# ${name}\nbody.\n`,
      'utf-8'
    )
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('skillService.list', () => {
  it('system skill 3개 + custom skill 통합 반환', () => {
    skillService.create({
      name: 'rally-my-skill',
      description: 'my desc',
      content: '---\nname: rally-my-skill\ndescription: my desc\n---\nbody'
    })
    const list = skillService.list()
    expect(list.filter((s) => s.source === 'system')).toHaveLength(SYSTEM_SKILL_NAMES.length)
    expect(list.filter((s) => s.source === 'custom')).toHaveLength(1)
    const sys = list.find((s) => s.name === 'rally')
    // system skill 도 내용은 편집 가능 (override 로 저장), 이름/삭제만 별도 제한.
    expect(sys?.editable).toBe(true)
    expect(sys?.hasOverride).toBe(false)
    expect(sys?.id).toBe('system:rally')
    expect(sys?.description).toContain('System skill rally')
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

  it('system skill content/mcpTools 수정은 override 로 저장 + hasOverride=true', () => {
    const updated = skillService.update('system:rally', {
      content: '---\nname: rally\ndescription: edited\n---\nedited body',
      mcpTools: ['read', 'browse']
    })
    expect(updated.source).toBe('system')
    expect(updated.hasOverride).toBe(true)
    expect(updated.content).toContain('edited body')
    expect(updated.mcpTools).toEqual(['read', 'browse'])
  })

  it('system skill resetSystem 으로 override 제거 → hasOverride=false', () => {
    skillService.update('system:rally', {
      content: '---\nname: rally\ndescription: edited\n---\nedited body',
      mcpTools: ['read']
    })
    const reset = skillService.resetSystem('system:rally')
    expect(reset.hasOverride).toBe(false)
    expect(reset.mcpTools).toEqual([])
  })

  it('존재하지 않는 id 는 NotFoundError', () => {
    expect(() => skillService.update('non-existent', { description: 'x' })).toThrow(NotFoundError)
  })
})

describe('skillService.remove (soft delete → 휴지통)', () => {
  it('커스텀 삭제하면 list 에서 빠지고 listTrashed 에 들어감', () => {
    const created = skillService.create({
      name: 'rally-removable',
      description: 'd',
      content: 'c'
    })
    skillService.remove(created.id)
    expect(skillService.list().find((s) => s.id === created.id)).toBeUndefined()
    expect(skillService.listTrashed().find((s) => s.id === created.id)).toBeDefined()
  })

  it('이미 휴지통에 있는 항목 remove 는 idempotent (에러 없음)', () => {
    const created = skillService.create({
      name: 'rally-twice-removed',
      description: 'd',
      content: 'c'
    })
    skillService.remove(created.id)
    expect(() => skillService.remove(created.id)).not.toThrow()
  })

  it('system skill 삭제는 ValidationError', () => {
    expect(() => skillService.remove('system:rally')).toThrow(ValidationError)
  })

  it('없는 id 는 NotFoundError', () => {
    expect(() => skillService.remove('nope')).toThrow(NotFoundError)
  })
})

describe('skillService.restore', () => {
  it('휴지통에서 복구하면 다시 list 에 등장', () => {
    const created = skillService.create({
      name: 'rally-recoverable',
      description: 'd',
      content: 'c'
    })
    skillService.remove(created.id)
    const restored = skillService.restore(created.id)
    expect(restored.id).toBe(created.id)
    expect(skillService.list().find((s) => s.id === created.id)).toBeDefined()
    expect(skillService.listTrashed().find((s) => s.id === created.id)).toBeUndefined()
  })

  it('이미 같은 이름의 활성 skill 이 있으면 ConflictError', () => {
    const a = skillService.create({ name: 'rally-conflict', description: 'a', content: 'a' })
    skillService.remove(a.id) // a 휴지통으로
    skillService.create({ name: 'rally-conflict', description: 'b', content: 'b' }) // 새로 만들기
    expect(() => skillService.restore(a.id)).toThrow(ConflictError)
  })

  it('system id 복구 시도는 ValidationError', () => {
    expect(() => skillService.restore('system:rally')).toThrow(ValidationError)
  })
})

describe('skillService.purge', () => {
  it('휴지통 항목 영구 삭제하면 listTrashed 에서도 사라짐', () => {
    const created = skillService.create({
      name: 'rally-purgeable',
      description: 'd',
      content: 'c'
    })
    skillService.remove(created.id)
    skillService.purge(created.id)
    expect(skillService.listTrashed().find((s) => s.id === created.id)).toBeUndefined()
    expect(() => skillService.get(created.id)).toThrow(NotFoundError)
  })

  it('활성 항목 purge 시도는 ValidationError (먼저 휴지통으로 보내야)', () => {
    const created = skillService.create({
      name: 'rally-active',
      description: 'd',
      content: 'c'
    })
    expect(() => skillService.purge(created.id)).toThrow(ValidationError)
  })

  it('system id purge 시도는 ValidationError', () => {
    expect(() => skillService.purge('system:rally')).toThrow(ValidationError)
  })
})

describe('skillService.get', () => {
  it('system: 접두사로 system skill 조회', () => {
    const got = skillService.get('system:rally-do')
    expect(got.source).toBe('system')
    expect(got.editable).toBe(true)
    expect(got.name).toBe('rally-do')
  })

  it('없는 system 은 NotFoundError', () => {
    expect(() => skillService.get('system:unknown-skill')).toThrow(NotFoundError)
  })
})
