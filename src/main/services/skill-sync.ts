import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PermissionError, ValidationError } from '../lib/errors'
import { skillService, SYSTEM_SKILL_NAMES } from './skill'

/**
 * Claude Desktop / Claude Code 가 공통으로 읽는 user-scope skill 디렉터리.
 * ~/.claude/skills/<name>/SKILL.md 가 표준 경로.
 */
function getUserSkillsRoot(): string {
  return join(app.getPath('home'), '.claude', 'skills')
}

function getSkillDir(name: string): string {
  return join(getUserSkillsRoot(), name)
}

function getSkillFile(name: string): string {
  return join(getSkillDir(name), 'SKILL.md')
}

/**
 * '.', '/', '..', 빈 문자열 등을 차단해 디렉터리 탈출 방지.
 * skill.ts validateName 과 동일한 규약을 강제하지만, 외부에서 들어온 raw name 도 한 번 더 검증.
 */
function assertSafeName(name: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(name)) {
    throw new ValidationError(`잘못된 skill 이름: ${name}`)
  }
}

function writeSkillFile(name: string, content: string): void {
  assertSafeName(name)
  const dir = getSkillDir(name)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(getSkillFile(name), content, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(
        `~/.claude/skills/${name} 에 쓰기 권한이 없습니다. 폴더 권한을 확인해 주세요.`
      )
    }
    throw err
  }
}

function removeSkillDir(name: string): void {
  assertSafeName(name)
  const dir = getSkillDir(name)
  if (!existsSync(dir)) return
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(
        `~/.claude/skills/${name} 삭제 권한이 없습니다. 폴더 권한을 확인해 주세요.`
      )
    }
    throw err
  }
}

export interface SkillApplyStatus {
  /** SkillItem.id */
  id: string
  name: string
  applied: boolean
}

export const skillSyncService = {
  getUserSkillsRoot,

  /**
   * skill id 로 ~/.claude/skills/<name>/SKILL.md 를 쓴다.
   * system skill 은 번들된 SKILL.md 를, custom 은 DB content 를 사용.
   */
  apply(id: string): SkillApplyStatus {
    const item = skillService.get(id)
    writeSkillFile(item.name, item.content)
    return { id: item.id, name: item.name, applied: true }
  },

  /**
   * skill id 로 적용된 파일을 제거. 파일이 없어도 OK (idempotent).
   * system skill 도 사용자가 원하면 해제 가능 (기본 skill 자체가 사라지진 않음).
   */
  unapply(id: string): SkillApplyStatus {
    const item = skillService.get(id)
    removeSkillDir(item.name)
    return { id: item.id, name: item.name, applied: false }
  },

  isApplied(name: string): boolean {
    assertSafeName(name)
    return existsSync(getSkillFile(name))
  },

  /**
   * 현재 ~/.claude/skills/ 아래에 존재하는 모든 skill 디렉터리 이름.
   * 외부에서 임의로 만든 폴더도 포함될 수 있음.
   */
  listAppliedNames(): string[] {
    const root = getUserSkillsRoot()
    if (!existsSync(root)) return []
    try {
      return readdirSync(root).filter((name) => {
        try {
          const full = join(root, name)
          return statSync(full).isDirectory() && existsSync(join(full, 'SKILL.md'))
        } catch {
          return false
        }
      })
    } catch {
      return []
    }
  },

  /**
   * 전체 skill 목록 + 적용 여부를 합쳐 반환. UI 새로고침 시 단일 호출로 충분하도록 설계.
   */
  status(): SkillApplyStatus[] {
    const applied = new Set(this.listAppliedNames())
    return skillService.list().map((item) => ({
      id: item.id,
      name: item.name,
      applied: applied.has(item.name)
    }))
  },

  /**
   * 커스텀 skill 삭제 시 함께 호출 — 적용 파일이 있으면 정리.
   * 이름만 알면 동작하므로 DB record 가 이미 삭제된 후에도 호출 가능.
   */
  cleanupByName(name: string): void {
    if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(name)) return
    if (SYSTEM_SKILL_NAMES.includes(name as (typeof SYSTEM_SKILL_NAMES)[number])) {
      // system skill 은 cleanup 대상 아님 (사용자 해제 액션을 통해서만 제거)
      return
    }
    removeSkillDir(name)
  }
}
