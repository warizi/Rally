/**
 * MCP tool-definitions 통합 export.
 * P3-7 — 도메인별 분할 후 registerAllTools 가 모든 도메인 tool 등록.
 * MCP v2 — deprecation 처리 (description banner + 응답 메타 주입).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
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
import type { DeprecationInfo, ToolDefinition, ToolSchema } from './types'

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

/**
 * deprecated 정보를 description 앞에 `[DEPRECATED]` banner 로 prefix.
 * AI 클라이언트가 도구 목록을 읽을 때 즉시 인지하도록 description 최상단에 부착.
 */
export function buildDescription(tool: ToolDefinition): string {
  if (!tool.deprecated) return tool.description
  const dep = tool.deprecated
  const since = dep.since ? ` (since ${dep.since})` : ''
  const reason = dep.reason ? ` — ${dep.reason}` : ''
  return `[DEPRECATED: use \`${dep.replacedBy}\` instead${since}]${reason}\n\n${tool.description}`
}

/**
 * deprecated tool 응답에 `_deprecation` 메타를 자동 주입.
 * - 응답이 단일 text content 이고 JSON parse 가능할 때만 주입
 * - 비-JSON / isError / multi-content 응답은 그대로 통과
 * - `_workspace` 는 항상 최상단 유지 (router.ts 의 envelope 규약과 일관)
 */
export function wrapHandlerWithDeprecation(tool: ToolDefinition): ToolCallback<ToolSchema> {
  if (!tool.deprecated) return tool.handler
  const dep = tool.deprecated
  const orig = tool.handler as unknown as (args: unknown, extra: unknown) => unknown
  const wrapped = async (args: unknown, extra: unknown): Promise<CallToolResult> => {
    const result = (await Promise.resolve(orig(args, extra))) as CallToolResult
    return injectDeprecationMeta(result, tool.name, dep)
  }
  return wrapped as unknown as ToolCallback<ToolSchema>
}

function injectDeprecationMeta(
  result: CallToolResult,
  toolName: string,
  dep: DeprecationInfo
): CallToolResult {
  const first = result.content?.[0]
  if (!first || first.type !== 'text' || typeof first.text !== 'string') return result
  let parsed: unknown
  try {
    parsed = JSON.parse(first.text)
  } catch {
    return result
  }
  if (!parsed || typeof parsed !== 'object') return result
  const obj = parsed as Record<string, unknown>

  const reorganized: Record<string, unknown> = {}
  if ('_workspace' in obj) reorganized._workspace = obj._workspace
  reorganized._deprecation = {
    tool: toolName,
    replacedBy: dep.replacedBy,
    ...(dep.since ? { since: dep.since } : {}),
    ...(dep.reason ? { reason: dep.reason } : {})
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k !== '_workspace' && k !== '_deprecation') reorganized[k] = v
  }

  return {
    ...result,
    content: [{ type: 'text', text: JSON.stringify(reorganized, null, 2) }]
  }
}

export function registerAllTools(server: McpServer): void {
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        description: buildDescription(tool),
        inputSchema: tool.schema
      },
      wrapHandlerWithDeprecation(tool)
    )
  }
}
