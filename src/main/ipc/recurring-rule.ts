import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { recurringRuleService } from '../services/recurring-rule'
import type { CreateRecurringRuleData, UpdateRecurringRuleData } from '../services/recurring-rule'

export function registerRecurringRuleHandlers(): void {
  ipcMain.handle(
    'recurringRule:findByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => recurringRuleService.findByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'recurringRule:findToday',
    (_: IpcMainInvokeEvent, workspaceId: string, date: Date): IpcResponse =>
      handle(() => recurringRuleService.findTodayRules(workspaceId, new Date(date)))
  )

  ipcMain.handle(
    'recurringRule:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: CreateRecurringRuleData): IpcResponse =>
      handle(() =>
        recurringRuleService.create(workspaceId, {
          ...data,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null
        })
      )
  )

  ipcMain.handle(
    'recurringRule:update',
    (_: IpcMainInvokeEvent, ruleId: string, data: UpdateRecurringRuleData): IpcResponse =>
      handle(() =>
        recurringRuleService.update(ruleId, {
          ...data,
          ...(data.startDate && { startDate: new Date(data.startDate) }),
          ...(data.endDate && { endDate: new Date(data.endDate) })
        })
      )
  )

  ipcMain.handle(
    'recurringRule:delete',
    (_: IpcMainInvokeEvent, ruleId: string): IpcResponse =>
      handle(() => recurringRuleService.delete(ruleId))
  )
}
