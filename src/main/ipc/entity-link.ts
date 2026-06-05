import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { linkableEntityTypeSchema } from './schemas'
import { entityLinkService } from '../services/entity-link'

export function registerEntityLinkHandlers(): void {
  ipcMain.handle(
    'entityLink:link',
    validateIpc(
      [linkableEntityTypeSchema, idSchema, linkableEntityTypeSchema, idSchema, idSchema] as const,
      (typeA, idA, typeB, idB, workspaceId) =>
        entityLinkService.link(typeA, idA, typeB, idB, workspaceId)
    )
  )

  ipcMain.handle(
    'entityLink:unlink',
    validateIpc(
      [linkableEntityTypeSchema, idSchema, linkableEntityTypeSchema, idSchema] as const,
      (typeA, idA, typeB, idB) => entityLinkService.unlink(typeA, idA, typeB, idB)
    )
  )

  ipcMain.handle(
    'entityLink:getLinked',
    validateIpc([linkableEntityTypeSchema, idSchema] as const, (entityType, entityId) =>
      entityLinkService.getLinked(entityType, entityId)
    )
  )
}
