import type { Router } from '../../router'
import { registerMcpItemRoutes } from './items'
import { registerMcpContentRoutes } from './content'
import { registerMcpFolderRoutes } from './folders'
import { registerMcpCanvasRoutes } from './canvases'
import { registerMcpTodoRoutes } from './todos'
import { registerMcpLinkRoutes } from './links'
import { registerMcpScheduleRoutes } from './schedules'
import { registerMcpReminderRoutes } from './reminders'
import { registerMcpRecurringRoutes } from './recurring'
import { registerMcpTemplateRoutes } from './templates'
import { registerMcpTagRoutes } from './tags'

export function registerMcpRoutes(router: Router): void {
  registerMcpItemRoutes(router)
  registerMcpContentRoutes(router)
  registerMcpFolderRoutes(router)
  registerMcpCanvasRoutes(router)
  registerMcpTodoRoutes(router)
  registerMcpLinkRoutes(router)
  registerMcpScheduleRoutes(router)
  registerMcpReminderRoutes(router)
  registerMcpRecurringRoutes(router)
  registerMcpTemplateRoutes(router)
  registerMcpTagRoutes(router)
}
