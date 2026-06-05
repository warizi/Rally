import type { IpcResponse } from './common'

export interface NoteImageAPI {
  saveFromPath: (workspaceId: string, sourcePath: string) => Promise<IpcResponse<string>>
  saveFromBuffer: (
    workspaceId: string,
    buffer: ArrayBuffer,
    ext: string
  ) => Promise<IpcResponse<string>>
  readImage: (
    workspaceId: string,
    relativePath: string
  ) => Promise<IpcResponse<{ data: ArrayBuffer }>>
}
