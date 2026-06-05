import type { IpcResponse } from './common'

/**
 * tab-session / tab-snapshot 계약 DTO.
 *
 * main `repositories/tab-session`·`tab-snapshot` 의 DB row 타입을 직접 노출하지 않고
 * bridge 계약으로 명시 정의한다. 구조는 현재 row 와 동일.
 */
export interface TabSessionDTO {
  id: number
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
  activePaneId: string
  updatedAt: Date
}

/** tabSession.upsert 입력 — id/updatedAt 은 main 이 채운다. */
export interface TabSessionUpsertInput {
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
  activePaneId: string
}

export interface TabSnapshotDTO {
  id: string
  name: string
  description: string | null
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
  createdAt: Date
  updatedAt: Date
}

export interface TabSessionAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSessionDTO>>
  upsert: (data: TabSessionUpsertInput) => Promise<IpcResponse<TabSessionDTO>>
}

export interface TabSnapshotAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSnapshotDTO[]>>
  create: (data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) => Promise<IpcResponse<TabSnapshotDTO>>
  update: (
    id: string,
    data: {
      name?: string
      description?: string
      tabsJson?: string
      panesJson?: string
      layoutJson?: string
    }
  ) => Promise<IpcResponse<TabSnapshotDTO>>
  delete: (id: string) => Promise<IpcResponse<void>>
}
