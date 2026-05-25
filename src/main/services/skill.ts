import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { is } from '@electron-toolkit/utils'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors'
import { customSkillRepository, type CustomSkill } from '../repositories/custom-skill'

export type SkillSource = 'system' | 'custom'

export interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  mcpTools: string[]
  triggers: string[]
  source: SkillSource
  /** false 면 UI 에서 수정/삭제 비활성 (system skill). */
  editable: boolean
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

function getBundledSkillsRoot(): string {
  return is.dev
    ? join(process.cwd(), '.claude', 'skills')
    : join(process.resourcesPath, '.claude', 'skills')
}

function loadSystemSkill(name: string): SkillItem | null {
  const skillMd = join(getBundledSkillsRoot(), name, 'SKILL.md')
  if (!existsSync(skillMd)) return null
  let content: string
  try {
    content = readFileSync(skillMd, 'utf-8')
  } catch {
    return null
  }
  const { description } = parseFrontmatter(content)
  return {
    id: `system:${name}`,
    name,
    description: description ?? '',
    content,
    mcpTools: [],
    triggers: [],
    source: 'system',
    editable: false,
    createdAt: new Date(0),
    updatedAt: new Date(0)
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
   * 시스템 + 커스텀 skill 통합 목록. 시스템이 먼저, 커스텀은 createdAt desc.
   */
  list(): SkillItem[] {
    const system = SYSTEM_SKILL_NAMES.map(loadSystemSkill).filter((s): s is SkillItem => s !== null)
    const custom = customSkillRepository.findAll().map(toItem)
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

    if (customSkillRepository.findByName(name)) {
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
      throw new ValidationError('기본 skill 은 수정할 수 없습니다.')
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

  remove(id: string): void {
    if (id.startsWith('system:')) {
      throw new ValidationError('기본 skill 은 삭제할 수 없습니다.')
    }
    const existing = customSkillRepository.findById(id)
    if (!existing) throw new NotFoundError(`Skill not found: ${id}`)
    customSkillRepository.delete(id)
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
