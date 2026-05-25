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
      name: 'my-skill',
      description: 'my desc',
      content: '---\nname: my-skill\ndescription: my desc\n---\nbody'
    })
    const list = skillService.list()
    expect(list.filter((s) => s.source === 'system')).toHaveLength(SYSTEM_SKILL_NAMES.length)
    expect(list.filter((s) => s.source === 'custom')).toHaveLength(1)
    const sys = list.find((s) => s.name === 'rally')
    expect(sys?.editable).toBe(false)
    expect(sys?.id).toBe('system:rally')
    expect(sys?.description).toContain('System skill rally')
  })
})

describe('skillService.create', () => {
  const base = {
    description: 'desc',
    content: '---\nname: x\ndescription: d\n---\nbody'
  }

  it('정상 생성 후 list 조회 가능', () => {
    const created = skillService.create({ name: 'my-tool', ...base })
    expect(created.source).toBe('custom')
    expect(created.editable).toBe(true)
    expect(created.mcpTools).toEqual([])
    expect(created.triggers).toEqual([])
    expect(skillService.list().some((s) => s.id === created.id)).toBe(true)
  })

  it('mcpTools / triggers 배열을 영속화', () => {
    const created = skillService.create({
      name: 'has-tools',
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
    expect(() => skillService.create({ name: 'MySkill', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: 'my skill', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: '내스킬', ...base })).toThrow(ValidationError)
  })

  it('system skill 과 이름 충돌은 ValidationError (RESERVED)', () => {
    expect(() => skillService.create({ name: 'rally', ...base })).toThrow(ValidationError)
    expect(() => skillService.create({ name: 'rally-do', ...base })).toThrow(ValidationError)
  })

  it('동일 커스텀 이름 중복은 ConflictError', () => {
    skillService.create({ name: 'dup', ...base })
    expect(() => skillService.create({ name: 'dup', ...base })).toThrow(ConflictError)
  })
})

describe('skillService.update', () => {
  it('description/content/mcpTools 부분 업데이트', () => {
    const created = skillService.create({
      name: 'editable',
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

  it('system skill 수정은 ValidationError', () => {
    expect(() => skillService.update('system:rally', { description: 'hacked' })).toThrow(
      ValidationError
    )
  })

  it('존재하지 않는 id 는 NotFoundError', () => {
    expect(() => skillService.update('non-existent', { description: 'x' })).toThrow(NotFoundError)
  })
})

describe('skillService.remove', () => {
  it('커스텀 삭제', () => {
    const created = skillService.create({
      name: 'removable',
      description: 'd',
      content: 'c'
    })
    skillService.remove(created.id)
    expect(skillService.list().find((s) => s.id === created.id)).toBeUndefined()
  })

  it('system skill 삭제는 ValidationError', () => {
    expect(() => skillService.remove('system:rally')).toThrow(ValidationError)
  })

  it('없는 id 는 NotFoundError', () => {
    expect(() => skillService.remove('nope')).toThrow(NotFoundError)
  })
})

describe('skillService.get', () => {
  it('system: 접두사로 system skill 조회', () => {
    const got = skillService.get('system:rally-do')
    expect(got.source).toBe('system')
    expect(got.editable).toBe(false)
    expect(got.name).toBe('rally-do')
  })

  it('없는 system 은 NotFoundError', () => {
    expect(() => skillService.get('system:unknown-skill')).toThrow(NotFoundError)
  })
})
