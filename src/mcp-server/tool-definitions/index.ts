/**
 * MCP tool-definitions 통합 export.
 * P3-7 — 도메인별 분할 후 registerAllTools 가 모든 도메인 tool 등록.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { itemsTools } from './items.tools'
import { canvasTools } from './canvas.tools'
import { todoTools } from './todo.tools'
import { linkTools } from './link.tools'
import { scheduleTools } from './schedule.tools'
import { reminderTools } from './reminder.tools'
import { recurringTools } from './recurring.tools'
import { templateTools } from './template.tools'
import { tagTools } from './tag.tools'
import { historyTools } from './history.tools'
import { fileTools } from './file.tools'
import { workspaceTools } from './workspace.tools'
import { trashTools } from './trash.tools'
import type { ToolDefinition } from './types'

export const allTools: ToolDefinition[] = [
  ...itemsTools,
  ...canvasTools,
  ...todoTools,
  ...linkTools,
  ...scheduleTools,
  ...reminderTools,
  ...recurringTools,
  ...templateTools,
  ...tagTools,
  ...historyTools,
  ...fileTools,
  ...workspaceTools,
  ...trashTools
]

export function registerAllTools(server: McpServer): void {
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema
      },
      tool.handler
    )
  }
}
