import { nanoid } from 'nanoid'
import { ConflictError, NotFoundError } from '../lib/errors'
import { tagRepository } from '../repositories/tag'
import { workspaceRepository } from '../repositories/workspace'

export interface TagItem {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date
}

function toTagItem(row: {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date | number
}): TagItem {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
  }
}

export interface CreateTagInput {
  name: string
  color: string
  description?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
  description?: string | null
}

export const tagService = {
  getAll(workspaceId: string): TagItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    return tagRepository.findByWorkspaceId(workspaceId).map(toTagItem)
  },

  create(workspaceId: string, input: CreateTagInput): TagItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const existing = tagRepository.findByName(workspaceId, input.name)
    if (existing) throw new ConflictError(`Tag already exists: ${input.name}`)

    const row = tagRepository.create({
      id: nanoid(),
      workspaceId,
      name: input.name,
      color: input.color,
      description: input.description ?? null,
      createdAt: new Date()
    })

    return toTagItem(row)
  },

  update(id: string, input: UpdateTagInput): TagItem {
    const tag = tagRepository.findById(id)
    if (!tag) throw new NotFoundError(`Tag not found: ${id}`)

    if (input.name && input.name !== tag.name) {
      const existing = tagRepository.findByName(tag.workspaceId, input.name)
      if (existing) throw new ConflictError(`Tag already exists: ${input.name}`)
    }

    const row = tagRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.description !== undefined && { description: input.description })
    })
    if (!row) throw new NotFoundError(`Tag not found: ${id}`)

    return toTagItem(row)
  },

  remove(id: string): void {
    const tag = tagRepository.findById(id)
    if (!tag) throw new NotFoundError(`Tag not found: ${id}`)

    tagRepository.delete(id)
  }
}
