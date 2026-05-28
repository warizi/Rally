import { nanoid } from 'nanoid'
import { ConflictError, NotFoundError } from '../lib/errors'
import { tagRepository } from '../repositories/tag'
import { workspaceRepository } from '../repositories/workspace'
import { type Actor, USER_ACTOR, toCreatedFields, toUpdatedFields } from './_shared/actor'
import { toDate } from './_shared/date'

export interface TagItem {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date
  createdBy?: 'user' | 'ai'
  createdById?: string | null
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
}

function toTagItem(row: {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date | number
  createdBy?: 'user' | 'ai'
  createdById?: string | null
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
}): TagItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    color: row.color,
    description: row.description,
    createdAt: toDate(row.createdAt),
    createdBy: row.createdBy ?? 'user',
    createdById: row.createdById ?? null,
    updatedBy: row.updatedBy ?? 'user',
    updatedById: row.updatedById ?? null
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

  create(workspaceId: string, input: CreateTagInput, actor: Actor = USER_ACTOR): TagItem {
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
      createdAt: new Date(),
      ...toCreatedFields(actor)
    })

    return toTagItem(row)
  },

  update(id: string, input: UpdateTagInput, actor: Actor = USER_ACTOR): TagItem {
    const tag = tagRepository.findById(id)
    if (!tag) throw new NotFoundError(`Tag not found: ${id}`)

    if (input.name && input.name !== tag.name) {
      const existing = tagRepository.findByName(tag.workspaceId, input.name)
      if (existing) throw new ConflictError(`Tag already exists: ${input.name}`)
    }

    const row = tagRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.description !== undefined && { description: input.description }),
      ...toUpdatedFields(actor)
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
