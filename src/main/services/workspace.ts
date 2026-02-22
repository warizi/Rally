import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import type { WorkspaceUpdate } from '../repositories/workspace'

export const workspaceService = {
  getAll() {
    return workspaceRepository.findAll()
  },

  getById(id: string) {
    const workspace = workspaceRepository.findById(id)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${id}`)
    return workspace
  },

  create(name: string) {
    if (!name.trim()) throw new ValidationError('Workspace name is required')
    return workspaceRepository.create({
      id: nanoid(),
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    })
  },

  update(id: string, data: WorkspaceUpdate) {
    const workspace = workspaceRepository.findById(id)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${id}`)
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Workspace name is required')
    }
    return workspaceRepository.update(id, {
      ...data,
      updatedAt: new Date()
    })
  },

  delete(id: string) {
    const workspace = workspaceRepository.findById(id)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${id}`)
    workspaceRepository.delete(id)
  }
}
