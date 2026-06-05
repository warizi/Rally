import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PermissionError, ValidationError } from '../lib/errors'
import { skillService, SYSTEM_SKILL_NAMES } from './skill'

/**
 * skill 을 적용할 대상 클라이언트.
 * - claude: Claude Code 가 읽는 ~/.claude/skills/<name>/SKILL.md (자동 트리거)
 * - codex:  Codex CLI/Desktop 가 읽는 ~/.agents/skills/<name>/SKILL.md
 */
export type SkillTarget = 'claude' | 'codex'
export const SKILL_TARGETS: SkillTarget[] = ['claude', 'codex']

/**
 * '.', '/', '..', 빈 문자열 등을 차단해 디렉터리 탈출 방지.
 * skill.ts validateName 과 동일한 규약을 강제하지만, 외부에서 들어온 raw name 도 한 번 더 검증.
 */
function assertSafeName(name: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(name)) {
    throw new ValidationError(`잘못된 skill 이름: ${name}`)
  }
}

function rethrowAsPermission(err: unknown, label: string): never {
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'EACCES' || code === 'EPERM') {
    throw new PermissionError(`${label} 에 접근 권한이 없습니다. 폴더 권한을 확인해 주세요.`)
  }
  throw err as Error
}

/** 타겟 클라이언트별 적용/해제/조회 추상화 */
interface SkillApplyTarget {
  readonly id: SkillTarget
  applyContent(name: string, content: string): void
  remove(name: string): void
  isApplied(name: string): boolean
  listAppliedNames(): string[]
}

// --- Claude: ~/.claude/skills/<name>/SKILL.md (디렉터리 기반) ---

function claudeSkillsRoot(): string {
  return join(app.getPath('home'), '.claude', 'skills')
}

const claudeTarget: SkillApplyTarget = {
  id: 'claude',
  applyContent(name, content) {
    assertSafeName(name)
    const dir = join(claudeSkillsRoot(), name)
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8')
    } catch (err) {
      rethrowAsPermission(err, `~/.claude/skills/${name}`)
    }
  },
  remove(name) {
    assertSafeName(name)
    const dir = join(claudeSkillsRoot(), name)
    if (!existsSync(dir)) return
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      rethrowAsPermission(err, `~/.claude/skills/${name}`)
    }
  },
  isApplied(name) {
    assertSafeName(name)
    return existsSync(join(claudeSkillsRoot(), name, 'SKILL.md'))
  },
  listAppliedNames() {
    const root = claudeSkillsRoot()
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
  }
}

// --- Codex: ~/.agents/skills/<name>/SKILL.md (디렉터리 기반) ---

function codexSkillsRoot(): string {
  return join(app.getPath('home'), '.agents', 'skills')
}

const codexTarget: SkillApplyTarget = {
  id: 'codex',
  applyContent(name, content) {
    assertSafeName(name)
    const dir = join(codexSkillsRoot(), name)
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8')
    } catch (err) {
      rethrowAsPermission(err, `~/.agents/skills/${name}`)
    }
  },
  remove(name) {
    assertSafeName(name)
    const dir = join(codexSkillsRoot(), name)
    if (!existsSync(dir)) return
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      rethrowAsPermission(err, `~/.agents/skills/${name}`)
    }
  },
  isApplied(name) {
    assertSafeName(name)
    return existsSync(join(codexSkillsRoot(), name, 'SKILL.md'))
  },
  listAppliedNames() {
    const root = codexSkillsRoot()
    if (!existsSync(root)) return []
    try {
      return readdirSync(root)
        .filter((name) => {
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
  }
}

const TARGETS: Record<SkillTarget, SkillApplyTarget> = {
  claude: claudeTarget,
  codex: codexTarget
}

export interface SkillApplyStatus {
  /** SkillItem.id */
  id: string
  name: string
  /** 타겟별 적용 여부 */
  applied: Record<SkillTarget, boolean>
}

function buildStatus(id: string, name: string): SkillApplyStatus {
  return {
    id,
    name,
    applied: {
      claude: claudeTarget.isApplied(name),
      codex: codexTarget.isApplied(name)
    }
  }
}

export const skillSyncService = {
  /** Claude skills 루트 (기존 호환용) */
  getUserSkillsRoot: claudeSkillsRoot,

  /**
   * skill id 를 지정 타겟에 적용.
   * - claude: ~/.claude/skills/<name>/SKILL.md (DB content 그대로)
   * - codex:  ~/.agents/skills/<name>/SKILL.md (DB content 그대로)
   */
  apply(id: string, target: SkillTarget = 'claude'): SkillApplyStatus {
    const item = skillService.get(id)
    TARGETS[target].applyContent(item.name, item.content)
    return buildStatus(item.id, item.name)
  },

  /** skill id 를 지정 타겟에서 해제. 적용된 적 없어도 OK (idempotent). */
  unapply(id: string, target: SkillTarget = 'claude'): SkillApplyStatus {
    const item = skillService.get(id)
    TARGETS[target].remove(item.name)
    return buildStatus(item.id, item.name)
  },

  /** 내용 변경/리셋으로 stale 된 적용본을 모든 타겟에서 제거. */
  unapplyStale(id: string): void {
    const item = skillService.get(id)
    for (const t of SKILL_TARGETS) {
      if (TARGETS[t].isApplied(item.name)) TARGETS[t].remove(item.name)
    }
  },

  isApplied(name: string, target: SkillTarget = 'claude'): boolean {
    return TARGETS[target].isApplied(name)
  },

  listAppliedNames(target: SkillTarget = 'claude'): string[] {
    return TARGETS[target].listAppliedNames()
  },

  /**
   * 전체 skill 목록 + 타겟별 적용 여부를 합쳐 반환. UI 새로고침 시 단일 호출로 충분하도록 설계.
   */
  status(): SkillApplyStatus[] {
    const appliedClaude = new Set(claudeTarget.listAppliedNames())
    const appliedCodex = new Set(codexTarget.listAppliedNames())
    return skillService.list().map((item) => ({
      id: item.id,
      name: item.name,
      applied: {
        claude: appliedClaude.has(item.name),
        codex: appliedCodex.has(item.name)
      }
    }))
  },

  /**
   * 커스텀 skill 삭제 시 함께 호출 — 모든 타겟의 적용 파일 정리.
   */
  cleanupByName(name: string): void {
    if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(name)) return
    if (SYSTEM_SKILL_NAMES.includes(name as (typeof SYSTEM_SKILL_NAMES)[number])) {
      return
    }
    for (const t of SKILL_TARGETS) TARGETS[t].remove(name)
  }
}
