import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { taggableEntityTypeSchema } from './schemas'
import { itemTagService } from '../services/item-tag'

export function registerItemTagHandlers(): void {
  ipcMain.handle(
    'itemTag:getTagsByItem',
    validateIpc([taggableEntityTypeSchema, idSchema] as const, (itemType, itemId) =>
      itemTagService.getTagsByItem(itemType, itemId)
    )
  )

  ipcMain.handle(
    'itemTag:getItemIdsByTag',
    validateIpc([idSchema, taggableEntityTypeSchema] as const, (tagId, itemType) =>
      itemTagService.getItemIdsByTag(tagId, itemType)
    )
  )

  ipcMain.handle(
    'itemTag:attach',
    validateIpc(
      [taggableEntityTypeSchema, idSchema, idSchema] as const,
      (itemType, tagId, itemId) => itemTagService.attach(itemType, tagId, itemId)
    )
  )

  ipcMain.handle(
    'itemTag:detach',
    validateIpc(
      [taggableEntityTypeSchema, idSchema, idSchema] as const,
      (itemType, tagId, itemId) => itemTagService.detach(itemType, tagId, itemId)
    )
  )
}
