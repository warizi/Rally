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

export interface SkillTargetStatus {
  id: string
  label: string
  applied: boolean
}

export interface SkillApplyStatus {
  id: string
  name: string
  /** 어느 한 target 에라도 적용돼 있으면 true. */
  applied: boolean
  /** 클라이언트별 세부 적용 여부 (Claude Code / Claude Desktop). */
  targets: SkillTargetStatus[]
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
