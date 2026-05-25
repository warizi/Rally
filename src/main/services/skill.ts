import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { is } from '@electron-toolkit/utils'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors'
import { customSkillRepository, type CustomSkill } from '../repositories/custom-skill'
import { systemSkillOverrideRepository } from '../repositories/system-skill-override'

export type SkillSource = 'system' | 'custom'

export interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  mcpTools: string[]
  triggers: string[]
  source: SkillSource
  /**
   * 사용자가 본문/메타 수정 가능 여부.
   * - custom: 항상 true
   * - system: 항상 true (override 로 DB 저장)
   *
   * 단, system skill 의 **이름** 은 변경 불가, 삭제도 불가 (UI 에서 분리 처리).
   */
  editable: boolean
  /** system skill 에 사용자 override 가 적용돼 있는지. UI 에서 "기본값으로 리셋" 버튼 노출용. */
  hasOverride?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateCustomSkillInput {
  name: string
  description: string
  content: string
  mcpTools?: string[]
  triggers?: string[]
}

export interface UpdateCustomSkillInput {
  description?: string
  content?: string
  mcpTools?: string[]
  triggers?: string[]
}

/**
 * 앱에 번들된 기본 skill 식별자.
 * `.claude/skills/<name>/SKILL.md` 가 source of truth.
 * 삭제·수정 불가 (UI 에서 잠금 처리).
 */
const SYSTEM_SKILL_NAMES = ['rally', 'rally-plan', 'rally-do'] as const

const DESCRIPTION_MAX_LENGTH = 4000
const CONTENT_MAX_LENGTH = 100_000
// 파일시스템 디렉터리명 + Claude skill name 규약: 영소문자/숫자/하이픈/언더스코어, 1~60자.
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/
const RESERVED_NAMES = new Set<string>(SYSTEM_SKILL_NAMES)
// 사용자 등록 skill 은 system skill 과의 네임스페이스 충돌 방지 + 'rally 계열' 식별 위해
// 'rally-' prefix 를 강제.
const CUSTOM_NAME_PREFIX = 'rally-'

function getBundledSkillsRoot(): string {
  return is.dev
    ? join(process.cwd(), '.claude', 'skills')
    : join(process.resourcesPath, '.claude', 'skills')
}

function loadSystemSkill(name: string): SkillItem | null {
  const skillMd = join(getBundledSkillsRoot(), name, 'SKILL.md')
  if (!existsSync(skillMd)) return null

  // 번들된 SKILL.md 를 fallback 으로 사용. 사용자 override 가 있으면 우선.
  let bundledContent: string
  try {
    bundledContent = readFileSync(skillMd, 'utf-8')
  } catch {
    return null
  }

  const override = systemSkillOverrideRepository.findByName(name)
  const content = override?.content ?? bundledContent
  const { description } = parseFrontmatter(content)
  const updatedAt = override?.updatedAt
    ? override.updatedAt instanceof Date
      ? override.updatedAt
      : new Date(override.updatedAt)
    : new Date(0)

  return {
    id: `system:${name}`,
    name,
    description: description ?? '',
    content,
    mcpTools: override ? safeJsonArray(override.mcpToolsJson) : [],
    triggers: override ? safeJsonArray(override.triggersJson) : [],
    source: 'system',
    editable: true,
    hasOverride: !!override,
    createdAt: new Date(0),
    updatedAt
  }
}

function parseFrontmatter(md: string): { description: string | null } {
  if (!md.startsWith('---')) return { description: null }
  const end = md.indexOf('\n---', 3)
  if (end === -1) return { description: null }
  const fm = md.slice(3, end)
  // description: |\n  line1\n  line2  형식과 description: text 형식 모두 처리.
  const blockMatch = fm.match(/^description:\s*\|\s*\n([\s\S]*?)(?=\n[a-zA-Z_-]+:|$)/m)
  if (blockMatch) {
    const dedented = blockMatch[1]
      .split('\n')
      .map((l) => l.replace(/^ {2}/, ''))
      .join('\n')
      .trim()
    return { description: dedented }
  }
  const inlineMatch = fm.match(/^description:\s*(.+)$/m)
  if (inlineMatch) return { description: inlineMatch[1].trim() }
  return { description: null }
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

function toItem(row: CustomSkill): SkillItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    mcpTools: safeJsonArray(row.mcpToolsJson),
    triggers: safeJsonArray(row.triggersJson),
    source: 'custom',
    editable: true,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)
  }
}

function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('skill 이름은 비워둘 수 없습니다.')
  if (!NAME_PATTERN.test(trimmed)) {
    throw new ValidationError('skill 이름은 영소문자/숫자/하이픈/언더스코어로 1~60자여야 합니다.')
  }
  if (RESERVED_NAMES.has(trimmed)) {
    throw new ValidationError(`'${trimmed}' 은(는) 기본 skill 이름이라 사용할 수 없습니다.`)
  }
  if (!trimmed.startsWith(CUSTOM_NAME_PREFIX) || trimmed.length <= CUSTOM_NAME_PREFIX.length) {
    throw new ValidationError(
      `커스텀 skill 이름은 '${CUSTOM_NAME_PREFIX}' 로 시작해야 합니다 (예: rally-my-skill).`
    )
  }
  return trimmed
}

function validateText(field: string, value: string, max: number): string {
  const trimmed = value.trim()
  if (!trimmed) throw new ValidationError(`${field} 은(는) 비워둘 수 없습니다.`)
  if (trimmed.length > max) {
    throw new ValidationError(`${field} 은(는) ${max}자 이하여야 합니다.`)
  }
  return trimmed
}

function validateStringArray(field: string, value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} 은(는) 문자열 배열이어야 합니다.`)
  }
  const cleaned: string[] = []
  for (const v of value) {
    if (typeof v !== 'string') {
      throw new ValidationError(`${field} 항목은 문자열이어야 합니다.`)
    }
    const t = v.trim()
    if (t) cleaned.push(t)
  }
  return cleaned
}

export const skillService = {
  /**
   * 시스템 + 활성 커스텀 skill 통합 목록 (휴지통 제외). 시스템이 먼저, 커스텀은 createdAt desc.
   */
  list(): SkillItem[] {
    const system = SYSTEM_SKILL_NAMES.map(loadSystemSkill).filter((s): s is SkillItem => s !== null)
    const custom = customSkillRepository.findActive().map(toItem)
    return [...system, ...custom]
  },

  get(id: string): SkillItem {
    if (id.startsWith('system:')) {
      const name = id.slice('system:'.length)
      const item = loadSystemSkill(name)
      if (!item) throw new NotFoundError(`System skill not found: ${name}`)
      return item
    }
    const row = customSkillRepository.findById(id)
    if (!row) throw new NotFoundError(`Skill not found: ${id}`)
    return toItem(row)
  },

  create(input: CreateCustomSkillInput): SkillItem {
    const name = validateName(input.name)
    const description = validateText('description', input.description, DESCRIPTION_MAX_LENGTH)
    const content = validateText('content', input.content, CONTENT_MAX_LENGTH)
    const mcpTools = validateStringArray('mcpTools', input.mcpTools)
    const triggers = validateStringArray('triggers', input.triggers)

    if (customSkillRepository.findActiveByName(name)) {
      throw new ConflictError(`이미 같은 이름의 skill 이 있습니다: ${name}`)
    }

    const now = new Date()
    const row = customSkillRepository.create({
      id: nanoid(),
      name,
      description,
      content,
      mcpToolsJson: JSON.stringify(mcpTools),
      triggersJson: JSON.stringify(triggers),
      createdAt: now,
      updatedAt: now
    })
    return toItem(row)
  },

  update(id: string, input: UpdateCustomSkillInput): SkillItem {
    if (id.startsWith('system:')) {
      // system skill 은 override 테이블에 upsert. description 은 frontmatter 에서 파생되므로 무시.
      const name = id.slice('system:'.length)
      if (!RESERVED_NAMES.has(name)) {
        throw new NotFoundError(`System skill not found: ${name}`)
      }
      // 현재 (override 또는 번들) content 를 base 로 patch
      const current = loadSystemSkill(name)
      if (!current) throw new NotFoundError(`System skill not found: ${name}`)
      const content =
        input.content !== undefined
          ? validateText('content', input.content, CONTENT_MAX_LENGTH)
          : current.content
      const mcpTools =
        input.mcpTools !== undefined
          ? validateStringArray('mcpTools', input.mcpTools)
          : current.mcpTools
      const triggers =
        input.triggers !== undefined
          ? validateStringArray('triggers', input.triggers)
          : current.triggers
      systemSkillOverrideRepository.upsert({
        name,
        content,
        mcpToolsJson: JSON.stringify(mcpTools),
        triggersJson: JSON.stringify(triggers),
        updatedAt: new Date()
      })
      const refreshed = loadSystemSkill(name)
      if (!refreshed) throw new NotFoundError(`System skill not found: ${name}`)
      return refreshed
    }
    const existing = customSkillRepository.findById(id)
    if (!existing) throw new NotFoundError(`Skill not found: ${id}`)

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.description !== undefined) {
      patch.description = validateText('description', input.description, DESCRIPTION_MAX_LENGTH)
    }
    if (input.content !== undefined) {
      patch.content = validateText('content', input.content, CONTENT_MAX_LENGTH)
    }
    if (input.mcpTools !== undefined) {
      patch.mcpToolsJson = JSON.stringify(validateStringArray('mcpTools', input.mcpTools))
    }
    if (input.triggers !== undefined) {
      patch.triggersJson = JSON.stringify(validateStringArray('triggers', input.triggers))
    }

    const row = customSkillRepository.update(id, patch)
    if (!row) throw new NotFoundError(`Skill not found: ${id}`)
    return toItem(row)
  },

  /**
   * system skill 의 사용자 override 를 제거하여 번들된 기본값으로 되돌린다.
   * override 가 없으면 noop.
   */
  resetSystem(id: string): SkillItem {
    if (!id.startsWith('system:')) {
      throw new ValidationError('system skill 만 리셋할 수 있습니다.')
    }
    const name = id.slice('system:'.length)
    if (!RESERVED_NAMES.has(name)) {
      throw new NotFoundError(`System skill not found: ${name}`)
    }
    systemSkillOverrideRepository.delete(name)
    const refreshed = loadSystemSkill(name)
    if (!refreshed) throw new NotFoundError(`System skill not found: ${name}`)
    return refreshed
  },

  /**
   * 삭제 가드 — system / not-found 만 검사. 실제 soft delete 는 trashService 가 담당.
   * Renderer 에서 직접 `trash:softRemove('custom_skill', id)` 를 호출해도 되지만,
   * skill 도메인 검증을 한 곳에 두기 위해 wrapper 유지.
   */
  ensureCustomDeletable(id: string): { name: string } {
    if (id.startsWith('system:')) {
      throw new ValidationError('기본 skill 은 삭제할 수 없습니다.')
    }
    const existing = customSkillRepository.findById(id)
    if (!existing) throw new NotFoundError(`Skill not found: ${id}`)
    return { name: existing.name }
  },

  isSystemName(name: string): boolean {
    return RESERVED_NAMES.has(name)
  },

  /**
   * 다른 layer (예: file-sync 서비스) 에서 system skill 디렉터리 위치가 필요할 때.
   */
  getBundledSkillsRoot
}

export { SYSTEM_SKILL_NAMES }
