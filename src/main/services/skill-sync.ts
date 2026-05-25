import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PermissionError, ValidationError } from '../lib/errors'
import { skillService, SYSTEM_SKILL_NAMES } from './skill'

/**
 * skill 파일을 적용할 대상 경로 (각 Claude 클라이언트의 user-scope skills 디렉터리).
 *
 * - Claude Code 는 모든 플랫폼에서 ~/.claude/skills/ 를 사용.
 * - Claude Desktop 은 OS 별 application data 경로를 사용.
 *   - macOS: ~/Library/Application Support/Claude/skills/
 *   - Windows: %APPDATA%/Claude/skills/
 *   - Linux: (Claude Desktop 미지원)
 */
function getTargetRoots(): { id: string; label: string; root: string }[] {
  const home = app.getPath('home')
  const targets: { id: string; label: string; root: string }[] = [
    { id: 'claudeCode', label: 'Claude Code', root: join(home, '.claude', 'skills') }
  ]
  if (process.platform === 'darwin') {
    targets.push({
      id: 'claudeDesktop',
      label: 'Claude Desktop',
      root: join(home, 'Library', 'Application Support', 'Claude', 'skills')
    })
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    targets.push({
      id: 'claudeDesktop',
      label: 'Claude Desktop',
      root: join(appData, 'Claude', 'skills')
    })
  }
  return targets
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

function writeSkillFile(root: string, label: string, name: string, content: string): void {
  const dir = join(root, name)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(
        `${label} (${dir}) 에 쓰기 권한이 없습니다. 폴더 권한을 확인해 주세요.`
      )
    }
    throw err
  }
}

function removeSkillDir(root: string, label: string, name: string): void {
  const dir = join(root, name)
  if (!existsSync(dir)) return
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(
        `${label} (${dir}) 삭제 권한이 없습니다. 폴더 권한을 확인해 주세요.`
      )
    }
    throw err
  }
}

export interface SkillApplyStatus {
  /** SkillItem.id */
  id: string
  name: string
  /** 어느 한 target 에라도 적용돼 있으면 true (UI 단순화용). */
  applied: boolean
  /** 클라이언트별 세부 적용 여부. */
  targets: { id: string; label: string; applied: boolean }[]
}

export const skillSyncService = {
  /**
   * skill id 로 모든 활성 target (~/.claude/skills + Claude Desktop 경로) 에 SKILL.md 작성.
   * system skill 은 번들된 SKILL.md 를, custom 은 DB content 를 사용.
   * 한 target 실패해도 다른 target 은 계속 시도하지만, 마지막에 오류가 있으면 첫 오류를 throw.
   */
  apply(id: string): SkillApplyStatus {
    const item = skillService.get(id)
    assertSafeName(item.name)
    const targets = getTargetRoots()
    let firstError: unknown = null
    for (const target of targets) {
      try {
        writeSkillFile(target.root, target.label, item.name, item.content)
      } catch (err) {
        if (!firstError) firstError = err
      }
    }
    if (firstError) throw firstError
    return {
      id: item.id,
      name: item.name,
      applied: true,
      targets: targets.map((t) => ({ id: t.id, label: t.label, applied: true }))
    }
  },

  /**
   * 모든 target 에서 적용 파일 제거. 파일 없어도 OK (idempotent).
   */
  unapply(id: string): SkillApplyStatus {
    const item = skillService.get(id)
    assertSafeName(item.name)
    const targets = getTargetRoots()
    let firstError: unknown = null
    for (const target of targets) {
      try {
        removeSkillDir(target.root, target.label, item.name)
      } catch (err) {
        if (!firstError) firstError = err
      }
    }
    if (firstError) throw firstError
    return {
      id: item.id,
      name: item.name,
      applied: false,
      targets: targets.map((t) => ({ id: t.id, label: t.label, applied: false }))
    }
  },

  isApplied(name: string): boolean {
    assertSafeName(name)
    return getTargetRoots().some((t) => existsSync(join(t.root, name, 'SKILL.md')))
  },

  /**
   * 모든 target 의 적용 skill 디렉터리 이름 union.
   */
  listAppliedNames(): string[] {
    const names = new Set<string>()
    for (const target of getTargetRoots()) {
      if (!existsSync(target.root)) continue
      try {
        for (const name of readdirSync(target.root)) {
          try {
            const full = join(target.root, name)
            if (statSync(full).isDirectory() && existsSync(join(full, 'SKILL.md'))) {
              names.add(name)
            }
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }
    }
    return [...names]
  },

  /**
   * 전체 skill 목록 + 적용 여부 (target 별 세부 포함).
   */
  status(): SkillApplyStatus[] {
    const targets = getTargetRoots()
    return skillService.list().map((item) => {
      const perTarget = targets.map((t) => ({
        id: t.id,
        label: t.label,
        applied: existsSync(join(t.root, item.name, 'SKILL.md'))
      }))
      return {
        id: item.id,
        name: item.name,
        applied: perTarget.some((t) => t.applied),
        targets: perTarget
      }
    })
  },

  /**
   * 커스텀 skill DB 삭제 시 함께 호출 — 모든 target 의 적용 파일 정리.
   * 이름만 알면 동작하므로 DB record 가 이미 삭제된 후에도 호출 가능.
   */
  cleanupByName(name: string): void {
    if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(name)) return
    if (SYSTEM_SKILL_NAMES.includes(name as (typeof SYSTEM_SKILL_NAMES)[number])) {
      // system skill 은 cleanup 대상 아님 (사용자 해제 액션을 통해서만 제거)
      return
    }
    for (const target of getTargetRoots()) {
      try {
        removeSkillDir(target.root, target.label, name)
      } catch {
        // 한 target 실패해도 다른 target 은 계속 시도
      }
    }
  }
}
