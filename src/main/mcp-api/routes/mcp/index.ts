import type { Router } from '../../router'
import { registerMcpItemRoutes } from './items'
import { registerMcpContentRoutes } from './content'
import { registerMcpFolderRoutes } from './folders'
import { registerMcpCanvasRoutes } from './canvases'
import { registerMcpTodoRoutes } from './todos'

export function registerMcpRoutes(router: Router): void {
  registerMcpItemRoutes(router)
  registerMcpContentRoutes(router)
  registerMcpFolderRoutes(router)
  registerMcpCanvasRoutes(router)
  registerMcpTodoRoutes(router)
}
