import type { IpcResponse } from './common'

export interface NoteStyleTemplateItem {
  id: string
  name: string
  settingsJson: string
  createdAt: Date
}

export interface NoteStyleTemplateAPI {
  list: () => Promise<IpcResponse<NoteStyleTemplateItem[]>>
  create: (input: {
    name: string
    settingsJson: string
  }) => Promise<IpcResponse<NoteStyleTemplateItem>>
  remove: (id: string) => Promise<IpcResponse<void>>
}
