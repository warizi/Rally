import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { entityLinkService } from '../services/entity-link'
import type { LinkableEntityType } from '../db/schema/entity-link'

export function registerEntityLinkHandlers(): void {
  ipcMain.handle(
    'entityLink:link',
    (
      _: IpcMainInvokeEvent,
      typeA: LinkableEntityType,
      idA: string,
      typeB: LinkableEntityType,
      idB: string,
      workspaceId: string
    ): IpcResponse => handle(() => entityLinkService.link(typeA, idA, typeB, idB, workspaceId))
  )

  ipcMain.handle(
    'entityLink:unlink',
    (
      _: IpcMainInvokeEvent,
      typeA: LinkableEntityType,
      idA: string,
      typeB: LinkableEntityType,
      idB: string
    ): IpcResponse => handle(() => entityLinkService.unlink(typeA, idA, typeB, idB))
  )

  ipcMain.handle(
    'entityLink:getLinked',
    (_: IpcMainInvokeEvent, entityType: LinkableEntityType, entityId: string): IpcResponse =>
      handle(() => entityLinkService.getLinked(entityType, entityId))
  )
}
