import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { tagRepository } from '../repositories/tag'
import { itemTagRepository } from '../repositories/item-tag'
import type { TaggableEntityType } from '../db/schema/tag'
import type { TagItem } from './tag'

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

export const itemTagService = {
  getTagsByItem(itemType: TaggableEntityType, itemId: string): TagItem[] {
    const rows = itemTagRepository.findByItem(itemType, itemId)
    const result: TagItem[] = []

    for (const row of rows) {
      const tag = tagRepository.findById(row.tagId)
      if (tag) result.push(toTagItem(tag))
    }

    return result
  },

  getItemIdsByTag(tagId: string, itemType: TaggableEntityType): string[] {
    return itemTagRepository
      .findByTag(tagId)
      .filter((row) => row.itemType === itemType)
      .map((row) => row.itemId)
  },

  attach(itemType: TaggableEntityType, tagId: string, itemId: string): void {
    const tag = tagRepository.findById(tagId)
    if (!tag) throw new NotFoundError(`Tag not found: ${tagId}`)

    itemTagRepository.attach({
      id: nanoid(),
      itemType,
      tagId,
      itemId,
      createdAt: new Date()
    })
  },

  detach(itemType: TaggableEntityType, tagId: string, itemId: string): void {
    itemTagRepository.detach(itemType, tagId, itemId)
  },

  removeByItem(itemType: TaggableEntityType, itemId: string): void {
    itemTagRepository.detachAllByItem(itemType, itemId)
  }
}
