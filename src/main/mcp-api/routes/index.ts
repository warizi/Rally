import type { Router } from '../router'
import { registerWorkspaceRoutes } from './workspace'
import { registerFolderRoutes } from './folder'
import { registerNoteRoutes } from './note'
import { registerSearchRoutes } from './search'
import { registerCsvRoutes } from './csv'
import { registerCanvasRoutes } from './canvas'
import { registerMcpRoutes } from './mcp'

export function registerAllRoutes(router: Router): void {
  registerWorkspaceRoutes(router)
  registerFolderRoutes(router)
  // search를 note보다 먼저 등록 (URL 매칭 순서)
  registerSearchRoutes(router)
  registerNoteRoutes(router)
  registerCsvRoutes(router)
  registerCanvasRoutes(router)
  // MCP 전용 라우트
  registerMcpRoutes(router)
}
