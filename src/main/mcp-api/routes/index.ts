import type { Router } from '../router'
import { registerMcpRoutes } from './mcp/index'

export function registerAllRoutes(router: Router): void {
  registerMcpRoutes(router)
}
