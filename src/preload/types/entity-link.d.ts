import type { IpcResponse } from './common'

export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image' | 'canvas'

export interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date
}

export interface EntityLinkAPI {
  link: (
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string,
    workspaceId: string
  ) => Promise<IpcResponse<void>>
  unlink: (
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string
  ) => Promise<IpcResponse<void>>
  getLinked: (
    entityType: LinkableEntityType,
    entityId: string
  ) => Promise<IpcResponse<LinkedEntity[]>>
  onChanged: (callback: () => void) => () => void
}
