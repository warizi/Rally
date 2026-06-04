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
   * 본문/메타 수정 가능 여부 (system / custom 모두 true).
   * system 의 **이름·삭제** 만 별도 제한 (UI 에서 분기 처리).
   */
  editable: boolean
  /** system skill 에 사용자 override 가 적용된 상태인지. */
  hasOverride?: boolean
  createdAt: Date
  updatedAt: Date
}

/** skill 을 적용할 대상 클라이언트 */
export type SkillTarget = 'claude' | 'codex'

export interface SkillApplyStatus {
  id: string
  name: string
  /** 타겟별 적용 여부 */
  applied: Record<SkillTarget, boolean>
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
