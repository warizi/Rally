import type { IpcResponse } from './common'

export type SkillSource = 'system' | 'custom'

export interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  mcpTools: string[]
  triggers: string[]
  source: SkillSource
  editable: boolean
  /** system skill 에 사용자 override 가 적용된 상태인지. */
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

export type SkillTarget = 'claude' | 'codex'

export interface SkillApplyStatus {
  id: string
  name: string
  applied: Record<SkillTarget, boolean>
}

export interface SkillAPI {
  list: () => Promise<IpcResponse<SkillItem[]>>
  get: (id: string) => Promise<IpcResponse<SkillItem>>
  create: (input: CreateCustomSkillInput) => Promise<IpcResponse<SkillItem>>
  update: (id: string, input: UpdateCustomSkillInput) => Promise<IpcResponse<SkillItem>>
  remove: (workspaceId: string, id: string) => Promise<IpcResponse<{ batchId: string }>>
  resetSystem: (id: string) => Promise<IpcResponse<SkillItem>>
  apply: (id: string, target?: SkillTarget) => Promise<IpcResponse<SkillApplyStatus>>
  unapply: (id: string, target?: SkillTarget) => Promise<IpcResponse<SkillApplyStatus>>
  status: () => Promise<IpcResponse<SkillApplyStatus[]>>
  export: (id: string) => Promise<IpcResponse<{ path: string } | null>>
}
