import { BrowserWindow } from 'electron'
import type { LinkableEntityType } from '../db/schema/entity-link'
import type { TaggableEntityType } from '../db/schema/tag'
import type { CanvasNodeType } from '../db/schema/canvas-node'
import { entityLinkService } from '../services/entity-link'
import { itemTagService } from '../services/item-tag'
import { canvasNodeRepository } from '../repositories/canvas-node'

type CleanupEntityType = LinkableEntityType & TaggableEntityType & CanvasNodeType

export function cleanupOrphansAndDelete(
  entityType: CleanupEntityType,
  orphanIds: string[],
  deleteOrphans: () => void
): void {
  for (const id of orphanIds) {
    entityLinkService.removeAllLinks(entityType, id)
    itemTagService.removeByItem(entityType, id)
    canvasNodeRepository.deleteByRef(entityType, id)
  }
  deleteOrphans()

  if (orphanIds.length > 0) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('entity-link:changed')
      })
    } catch {
      // BrowserWindow unavailable (unit test environment)
    }
  }
}
