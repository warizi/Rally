import { ipcMain } from 'electron'
import { handle } from '../lib/handle'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import { trashListOptionsSchema, trashRetentionKeySchema, trashEntityKindSchema } from './schemas'
import { trashService } from '../services/trash'

/**
 * trashService.softRemove/restore/purge 가 자동으로 'trash:changed' broadcast를 emit하므로
 * IPC handler 자체에서는 별도 broadcast 호출 없음.
 */
export function registerTrashHandlers(): void {
  ipcMain.handle(
    'trash:list',
    validateIpc([idSchema, trashListOptionsSchema] as const, (workspaceId, options) =>
      trashService.list(workspaceId, options ?? {})
    )
  )

  ipcMain.handle(
    'trash:count',
    validateIpc([idSchema], (workspaceId) => trashService.countByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'trash:restore',
    validateIpc([idSchema, idSchema] as const, (_workspaceId, batchId) =>
      trashService.restore(batchId)
    )
  )

  ipcMain.handle(
    'trash:purge',
    validateIpc([idSchema, idSchema] as const, (_workspaceId, batchId) => {
      trashService.purge(batchId)
      return { success: true }
    })
  )

  ipcMain.handle(
    'trash:emptyAll',
    validateIpc([idSchema], (workspaceId) => {
      const purgedBatchIds: string[] = []
      let hasMore = true
      // 페이지네이션 한계(200)를 고려해 반복
      while (hasMore) {
        const list = trashService.list(workspaceId, { limit: 200 })
        for (const batch of list.batches) {
          trashService.purge(batch.id)
          purgedBatchIds.push(batch.id)
        }
        hasMore = list.hasMore && list.batches.length > 0
      }
      return { purgedBatchIds }
    })
  )

  ipcMain.handle(
    'trash:getRetention',
    validateNoArgs(() => handle(() => trashService.getRetention()))
  )

  ipcMain.handle(
    'trash:setRetention',
    validateIpc([trashRetentionKeySchema], (value) => {
      trashService.setRetention(value)
      return { value }
    })
  )

  ipcMain.handle(
    'trash:sweepNow',
    validateNoArgs(() => handle(() => ({ purged: trashService.sweepAll() })))
  )

  ipcMain.handle(
    'trash:softRemove',
    validateIpc(
      [idSchema, trashEntityKindSchema, idSchema] as const,
      (workspaceId, entityType, entityId) => ({
        batchId: trashService.softRemove(workspaceId, entityType, entityId)
      })
    )
  )
}
