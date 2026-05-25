import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpHome: string

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'home') return tmpHome
      return tmpHome
    }
  }
}))

import { skillSyncService } from '../skill-sync'
import { skillService, seedSystemSkills } from '../skill'
import { ValidationError } from '../../lib/errors'

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'rally-home-'))
  // DB 기반이므로 매 테스트마다 system_skills 재seed.
  seedSystemSkills()
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(tmpHome, { recursive: true, force: true })
})

describe('skillSyncService.apply', () => {
  it('system skill 을 ~/.claude/skills/<name>/SKILL.md 로 작성 (DB content)', () => {
    const result = skillSyncService.apply('system:rally')
    expect(result.applied).toBe(true)
    expect(result.name).toBe('rally')
    const expected = join(tmpHome, '.claude', 'skills', 'rally', 'SKILL.md')
    expect(existsSync(expected)).toBe(true)
    // seed content 의 일부가 들어 있어야 함.
    expect(readFileSync(expected, 'utf-8')).toContain('# Rally MCP Skill')
  })

  it('custom skill 을 DB content 로 작성', () => {
    const created = skillService.create({
      name: 'rally-my-custom',
      description: 'my desc',
      content: '---\nname: my-custom\ndescription: my desc\n---\n# custom body\n'
    })
    const result = skillSyncService.apply(created.id)
    expect(result.applied).toBe(true)
    const file = join(tmpHome, '.claude', 'skills', 'rally-my-custom', 'SKILL.md')
    expect(readFileSync(file, 'utf-8')).toContain('# custom body')
  })

  it('재적용은 덮어쓰기 (idempotent)', () => {
    const created = skillService.create({
      name: 'rally-overwrite-target',
      description: 'd',
      content: 'first'
    })
    skillSyncService.apply(created.id)
    skillService.update(created.id, { content: 'second' })
    skillSyncService.apply(created.id)
    const file = join(tmpHome, '.claude', 'skills', 'rally-overwrite-target', 'SKILL.md')
    expect(readFileSync(file, 'utf-8')).toBe('second')
  })
})

describe('skillSyncService.unapply', () => {
  it('적용된 skill 디렉터리를 제거', () => {
    skillSyncService.apply('system:rally')
    const dir = join(tmpHome, '.claude', 'skills', 'rally')
    expect(existsSync(dir)).toBe(true)
    skillSyncService.unapply('system:rally')
    expect(existsSync(dir)).toBe(false)
  })

  it('적용된 적 없어도 에러 없이 통과 (idempotent)', () => {
    expect(() => skillSyncService.unapply('system:rally')).not.toThrow()
  })
})

describe('skillSyncService.isApplied / listAppliedNames', () => {
  it('적용 전 false, 적용 후 true', () => {
    expect(skillSyncService.isApplied('rally')).toBe(false)
    skillSyncService.apply('system:rally')
    expect(skillSyncService.isApplied('rally')).toBe(true)
  })

  it('listAppliedNames 는 SKILL.md 가 존재하는 디렉터리만 반환', () => {
    skillSyncService.apply('system:rally')
    skillSyncService.apply('system:rally-do')
    // SKILL.md 없는 빈 디렉터리는 무시
    mkdirSync(join(tmpHome, '.claude', 'skills', 'empty-dir'), { recursive: true })
    const names = skillSyncService.listAppliedNames().sort()
    expect(names).toEqual(['rally', 'rally-do'])
  })

  it('잘못된 이름은 ValidationError', () => {
    expect(() => skillSyncService.isApplied('../etc/passwd')).toThrow(ValidationError)
  })
})

describe('skillSyncService.status', () => {
  it('전체 skill 목록 + 적용 여부 반환', () => {
    skillSyncService.apply('system:rally')
    const status = skillSyncService.status()
    const rally = status.find((s) => s.name === 'rally')
    const rallyDo = status.find((s) => s.name === 'rally-do')
    expect(rally?.applied).toBe(true)
    expect(rallyDo?.applied).toBe(false)
  })
})

describe('skillSyncService.cleanupByName', () => {
  it('해당 이름의 디렉터리 삭제', () => {
    skillService.create({ name: 'rally-cleanup-target', description: 'd', content: 'c' })
    const items = skillService.list()
    const item = items.find((s) => s.name === 'rally-cleanup-target')!
    skillSyncService.apply(item.id)
    expect(existsSync(join(tmpHome, '.claude', 'skills', 'rally-cleanup-target'))).toBe(true)
    skillSyncService.cleanupByName('rally-cleanup-target')
    expect(existsSync(join(tmpHome, '.claude', 'skills', 'rally-cleanup-target'))).toBe(false)
  })

  it('system skill 이름은 cleanup 대상 아님 (보호)', () => {
    skillSyncService.apply('system:rally')
    skillSyncService.cleanupByName('rally')
    expect(existsSync(join(tmpHome, '.claude', 'skills', 'rally'))).toBe(true)
  })

  it('이상한 이름은 무시 (보안: 디렉터리 탈출 방지)', () => {
    expect(() => skillSyncService.cleanupByName('../evil')).not.toThrow()
    // 외부 파일 영향 없음
  })
})
