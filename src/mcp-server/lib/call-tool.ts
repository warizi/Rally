import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { mcpRequest } from './http-client'

export async function callTool(
  method: string,
  urlPath: string,
  body?: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    const { status, data } = await mcpRequest(method, urlPath, body)
    if (status !== 200) {
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: true }
    }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  } catch (error) {
    return {
      content: [{ type: 'text', text: (error as Error).message }],
      isError: true
    }
  }
}
