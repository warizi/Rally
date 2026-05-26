import { nanoid } from 'nanoid'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors'
import { customSkillRepository, type CustomSkill } from '../repositories/custom-skill'
import { systemSkillRepository, type SystemSkill } from '../repositories/system-skill'
import { SYSTEM_SKILL_NAMES, SYSTEM_SKILL_SEEDS, getSystemSkillSeed } from './system-skills-seed'

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
   * - system: 항상 true (이름 변경/삭제만 불가)
   */
  editable: boolean
  /**
   * system skill 이 코드 default 와 다른 값으로 수정된 상태인지.
   * UI 에서 "수정됨" 배지 + "기본값으로 복원" 버튼 노출용.
   * custom skill 에서는 항상 undefined.
   */
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

const DESCRIPTION_MAX_LENGTH = 4000
const CONTENT_MAX_LENGTH = 100_000
// 파일시스템 디렉터리명 + Claude skill name 규약: 영소문자/숫자/하이픈/언더스코어, 1~60자.
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/
const RESERVED_NAMES = new Set<string>(SYSTEM_SKILL_NAMES)
// 사용자 등록 skill 은 system skill 과의 네임스페이스 충돌 방지 + 'rally 계열' 식별 위해
// 'rally-' prefix 를 강제.
const CUSTOM_NAME_PREFIX = 'rally-'

/**
 * 첫 부팅 시 호출 — 코드 default 가 DB 에 없으면 row 를 만든다.
 * 이미 row 가 있으면 (사용자 수정 포함) 절대 덮어쓰지 않는다.
 * "기본값으로 복원" 은 `resetSystem` 이 담당.
 */
export function seedSystemSkills(): void {
  const now = new Date()
  for (const seed of SYSTEM_SKILL_SEEDS) {
    if (systemSkillRepository.findByName(seed.name)) continue
    systemSkillRepository.insert({
      name: seed.name,
      content: seed.content,
      mcpToolsJson: JSON.stringify(seed.mcpTools),
      triggersJson: JSON.stringify(seed.triggers),
      createdAt: now,
      updatedAt: now
    })
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

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function toSystemItem(row: SystemSkill): SkillItem {
  const seed = getSystemSkillSeed(row.name)
  const mcpTools = safeJsonArray(row.mcpToolsJson)
  const triggers = safeJsonArray(row.triggersJson)
  const hasOverride = seed
    ? row.content !== seed.content ||
      !arraysEqual(mcpTools, seed.mcpTools) ||
      !arraysEqual(triggers, seed.triggers)
    : true
  const { description } = parseFrontmatter(row.content)
  return {
    id: `system:${row.name}`,
    name: row.name,
    description: description ?? '',
    content: row.content,
    mcpTools,
    triggers,
    source: 'system',
    editable: true,
    hasOverride,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)
  }
}

function loadSystemSkill(name: string): SkillItem | null {
  const row = systemSkillRepository.findByName(name)
  if (!row) return null
  return toSystemItem(row)
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
   * 시스템 + 활성 커스텀 skill 통합 목록 (휴지통 제외).
   * 시스템은 SYSTEM_SKILL_NAMES 정의 순서대로, 커스텀은 createdAt desc.
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
      // system skill 은 DB row 를 직접 수정. description 은 frontmatter 에서 파생되므로 무시.
      const name = id.slice('system:'.length)
      if (!RESERVED_NAMES.has(name)) {
        throw new NotFoundError(`System skill not found: ${name}`)
      }
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
      systemSkillRepository.update(name, {
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
   * system skill 을 코드 default 값으로 되돌린다.
   * row 가 어떤 이유로 누락됐어도 seed 가 다시 채워준다 (idempotent).
   */
  resetSystem(id: string): SkillItem {
    if (!id.startsWith('system:')) {
      throw new ValidationError('system skill 만 리셋할 수 있습니다.')
    }
    const name = id.slice('system:'.length)
    const seed = getSystemSkillSeed(name)
    if (!seed) throw new NotFoundError(`System skill not found: ${name}`)
    const existing = systemSkillRepository.findByName(name)
    const now = new Date()
    systemSkillRepository.upsert({
      name: seed.name,
      content: seed.content,
      mcpToolsJson: JSON.stringify(seed.mcpTools),
      triggersJson: JSON.stringify(seed.triggers),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
    const refreshed = loadSystemSkill(name)
    if (!refreshed) throw new NotFoundError(`System skill not found: ${name}`)
    return refreshed
  },

  /**
   * 삭제 가드 — system / not-found 만 검사. 실제 soft delete 는 trashService 가 담당.
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
  }
}

export { SYSTEM_SKILL_NAMES }
