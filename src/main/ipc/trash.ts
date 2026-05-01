import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import {
  trashService,
  type TrashEntityKind,
  type TrashListOptions,
  type TrashRetentionKey
} from '../services/trash'

/**
 * trashService.softRemove/restore/purge 가 자동으로 'trash:changed' broadcast를 emit하므로
 * IPC handler 자체에서는 별도 broadcast 호출 없음.
 */
export function registerTrashHandlers(): void {
  ipcMain.handle(
    'trash:list',
    (_: IpcMainInvokeEvent, workspaceId: string, options?: TrashListOptions): IpcResponse =>
      handle(() => trashService.list(workspaceId, options ?? {}))
  )

  ipcMain.handle(
    'trash:count',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => trashService.countByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'trash:restore',
    (_: IpcMainInvokeEvent, _workspaceId: string, batchId: string): IpcResponse =>
      handle(() => trashService.restore(batchId))
  )

  ipcMain.handle(
    'trash:purge',
    (_: IpcMainInvokeEvent, _workspaceId: string, batchId: string): IpcResponse =>
      handle(() => {
        trashService.purge(batchId)
        return { success: true }
      })
  )

  ipcMain.handle(
    'trash:emptyAll',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => {
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

  ipcMain.handle('trash:getRetention', (): IpcResponse => handle(() => trashService.getRetention()))

  ipcMain.handle(
    'trash:setRetention',
    (_: IpcMainInvokeEvent, value: TrashRetentionKey): IpcResponse =>
      handle(() => {
        trashService.setRetention(value)
        return { value }
      })
  )

  ipcMain.handle(
    'trash:sweepNow',
    (): IpcResponse => handle(() => ({ purged: trashService.sweepAll() }))
  )

  ipcMain.handle(
    'trash:softRemove',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      entityType: TrashEntityKind,
      entityId: string
    ): IpcResponse =>
      handle(() => ({ batchId: trashService.softRemove(workspaceId, entityType, entityId) }))
  )
}
