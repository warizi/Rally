import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { itemTagService } from '../services/item-tag'
import type { TaggableEntityType } from '../db/schema/tag'

export function registerItemTagHandlers(): void {
  ipcMain.handle(
    'itemTag:getTagsByItem',
    (_: IpcMainInvokeEvent, itemType: TaggableEntityType, itemId: string): IpcResponse =>
      handle(() => itemTagService.getTagsByItem(itemType, itemId))
  )

  ipcMain.handle(
    'itemTag:getItemIdsByTag',
    (_: IpcMainInvokeEvent, tagId: string, itemType: TaggableEntityType): IpcResponse =>
      handle(() => itemTagService.getItemIdsByTag(tagId, itemType))
  )

  ipcMain.handle(
    'itemTag:attach',
    (
      _: IpcMainInvokeEvent,
      itemType: TaggableEntityType,
      tagId: string,
      itemId: string
    ): IpcResponse => handle(() => itemTagService.attach(itemType, tagId, itemId))
  )

  ipcMain.handle(
    'itemTag:detach',
    (
      _: IpcMainInvokeEvent,
      itemType: TaggableEntityType,
      tagId: string,
      itemId: string
    ): IpcResponse => handle(() => itemTagService.detach(itemType, tagId, itemId))
  )
}
