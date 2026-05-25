import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle, handleAsync } from '../lib/handle'
import {
  skillService,
  type CreateCustomSkillInput,
  type UpdateCustomSkillInput
} from '../services/skill'
import { skillSyncService } from '../services/skill-sync'
import { skillExportService } from '../services/skill-export'

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', (): IpcResponse => handle(() => skillService.list()))

  ipcMain.handle('skill:listTrashed', (): IpcResponse => handle(() => skillService.listTrashed()))

  ipcMain.handle(
    'skill:get',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.get(id))
  )

  ipcMain.handle(
    'skill:create',
    (_: IpcMainInvokeEvent, input: CreateCustomSkillInput): IpcResponse =>
      handle(() => skillService.create(input))
  )

  ipcMain.handle(
    'skill:update',
    (_: IpcMainInvokeEvent, id: string, input: UpdateCustomSkillInput): IpcResponse =>
      handle(() => skillService.update(id, input))
  )

  ipcMain.handle(
    'skill:remove',
    (_: IpcMainInvokeEvent, id: string): IpcResponse =>
      handle(() => {
        // soft delete (휴지통 이동) + ~/.claude/skills 의 적용 파일 정리.
        // 적용 파일은 복구 후 다시 수동 적용 필요 (의도된 동작 — 휴지통에 있는 동안 Claude 가 인식하지 않도록).
        const item = skillService.get(id)
        skillService.remove(id)
        skillSyncService.cleanupByName(item.name)
      })
  )

  ipcMain.handle(
    'skill:restore',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.restore(id))
  )

  ipcMain.handle(
    'skill:purge',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.purge(id))
  )

  ipcMain.handle(
    'skill:resetSystem',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.resetSystem(id))
  )

  ipcMain.handle(
    'skill:apply',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillSyncService.apply(id))
  )

  ipcMain.handle(
    'skill:unapply',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillSyncService.unapply(id))
  )

  ipcMain.handle('skill:status', (): IpcResponse => handle(() => skillSyncService.status()))

  ipcMain.handle(
    'skill:export',
    (_: IpcMainInvokeEvent, id: string): Promise<IpcResponse> =>
      handleAsync(() => skillExportService.exportWithDialog(id))
  )
}
