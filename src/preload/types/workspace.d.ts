import type { IpcResponse } from './common'

/**
 * renderer 에 공개되는 workspace 계약 DTO.
 *
 * main `repositories/workspace` 의 DB row 타입(`Workspace`)을 직접 노출하지 않고,
 * bridge 계약으로 명시 정의해 main 내부 모델 변경이 renderer 계약으로 번지지 않게 한다.
 * 구조는 현재 row 와 동일하며, 어긋나면 `workspace:getAll` 등의 호출부 typecheck 가 잡는다.
 */
export interface WorkspaceDTO {
  id: string
  name: string
  path: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceAPI {
  getAll: () => Promise<IpcResponse<WorkspaceDTO[]>>
  getById: (id: string) => Promise<IpcResponse<WorkspaceDTO>>
  create: (name: string, path: string) => Promise<IpcResponse<WorkspaceDTO>>
  update: (
    id: string,
    data: Partial<Pick<WorkspaceDTO, 'name' | 'path' | 'updatedAt'>>
  ) => Promise<IpcResponse<WorkspaceDTO>>
  delete: (id: string) => Promise<IpcResponse<void>>
  activate: (id: string) => Promise<IpcResponse<WorkspaceDTO>>
  selectDirectory: () => Promise<string | null>
  onActiveChanged: (callback: (workspaceId: string, _: string[]) => void) => () => void
}
