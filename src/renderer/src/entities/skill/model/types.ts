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

export interface SkillApplyStatus {
  id: string
  name: string
  applied: boolean
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
