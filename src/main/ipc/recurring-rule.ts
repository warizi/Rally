import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { dateSchema, recurringRuleCreateSchema, recurringRuleUpdateSchema } from './schemas'
import { recurringRuleService } from '../services/recurring-rule'

export function registerRecurringRuleHandlers(): void {
  ipcMain.handle(
    'recurringRule:findByWorkspace',
    validateIpc([idSchema], (workspaceId) => recurringRuleService.findByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'recurringRule:findToday',
    validateIpc([idSchema, dateSchema] as const, (workspaceId, date) =>
      recurringRuleService.findTodayRules(workspaceId, new Date(date))
    )
  )

  ipcMain.handle(
    'recurringRule:create',
    validateIpc([idSchema, recurringRuleCreateSchema] as const, (workspaceId, data) =>
      recurringRuleService.create(workspaceId, {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null
      })
    )
  )

  ipcMain.handle(
    'recurringRule:update',
    validateIpc([idSchema, recurringRuleUpdateSchema] as const, (ruleId, data) =>
      recurringRuleService.update(ruleId, {
        ...data,
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) })
      })
    )
  )

  ipcMain.handle(
    'recurringRule:delete',
    validateIpc([idSchema], (ruleId) => recurringRuleService.delete(ruleId))
  )
}
