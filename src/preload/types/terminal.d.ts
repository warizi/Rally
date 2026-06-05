import type { IpcResponse } from './common'

export interface TerminalSessionRow {
  id: string
  workspaceId: string
  layoutId: string | null
  name: string
  cwd: string
  shell: string
  rows: number
  cols: number
  screenSnapshot: string | null
  sortOrder: number
  isActive: number
  createdAt: Date
  updatedAt: Date
}

export interface TerminalLayoutRow {
  id: string
  workspaceId: string
  layoutJson: string
  createdAt: Date
  updatedAt: Date
}

export interface TerminalAPI {
  create: (args: {
    workspaceId: string
    cwd: string
    shell?: string
    cols: number
    rows: number
    id?: string
    sortOrder?: number
  }) => Promise<IpcResponse<{ id: string }>>
  destroy: (id: string) => Promise<IpcResponse<void>>
  destroyAll: (workspaceId: string) => Promise<IpcResponse<void>>
  write: (args: { id: string; data: string }) => void
  resize: (args: { id: string; cols: number; rows: number }) => void
  saveSnapshot: (id: string, snapshot: string) => Promise<IpcResponse<void>>
  onData: (id: string, callback: (data: { data: string }) => void) => () => void
  onExit: (id: string, callback: (data: { exitCode: number }) => void) => () => void
  getSessions: (workspaceId: string) => Promise<IpcResponse<TerminalSessionRow[]>>
  getLayout: (workspaceId: string) => Promise<IpcResponse<TerminalLayoutRow | null>>
  updateSession: (
    id: string,
    data: Partial<Pick<TerminalSessionRow, 'name' | 'cwd' | 'rows' | 'cols' | 'sortOrder'>>
  ) => Promise<IpcResponse<void>>
  saveLayout: (workspaceId: string, layoutJson: string) => Promise<IpcResponse<void>>
  closeSession: (id: string) => Promise<IpcResponse<void>>
}
