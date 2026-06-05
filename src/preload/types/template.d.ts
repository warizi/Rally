import type { IpcResponse } from './common'

export interface TemplateItem {
  id: string
  workspaceId: string
  title: string
  type: 'note' | 'csv'
  jsonData: string
  createdAt: Date
}

export interface TemplateAPI {
  list: (workspaceId: string, type: 'note' | 'csv') => Promise<IpcResponse<TemplateItem[]>>
  create: (input: {
    workspaceId: string
    title: string
    type: 'note' | 'csv'
    jsonData: string
  }) => Promise<IpcResponse<TemplateItem>>
  delete: (id: string) => Promise<IpcResponse<void>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}
