import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { tabSnapshotRepository } from '../repositories/tab-snapshot'
import type { TabSnapshotUpdate } from '../repositories/tab-snapshot'

export const tabSnapshotService = {
  getByWorkspaceId(workspaceId: string) {
    return tabSnapshotRepository.findByWorkspaceId(workspaceId)
  },

  create(data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) {
    if (!data.name.trim()) throw new ValidationError('Snapshot name is required')
    if (!data.tabsJson || !data.panesJson || !data.layoutJson) {
      throw new ValidationError('Invalid snapshot data')
    }
    return tabSnapshotRepository.create({
      id: nanoid(),
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      workspaceId: data.workspaceId,
      tabsJson: data.tabsJson,
      panesJson: data.panesJson,
      layoutJson: data.layoutJson,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  },

  update(id: string, data: TabSnapshotUpdate) {
    const snapshot = tabSnapshotRepository.findById(id)
    if (!snapshot) throw new NotFoundError(`TabSnapshot not found: ${id}`)
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Snapshot name is required')
    }
    return tabSnapshotRepository.update(id, {
      ...data,
      updatedAt: new Date()
    })
  },

  delete(id: string) {
    const snapshot = tabSnapshotRepository.findById(id)
    if (!snapshot) throw new NotFoundError(`TabSnapshot not found: ${id}`)
    tabSnapshotRepository.delete(id)
  }
}
