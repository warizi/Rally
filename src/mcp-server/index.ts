import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerAllTools } from './tool-definitions'
import { setClientInfo } from './lib/client-info'

const server = new McpServer({
  name: 'rally',
  version: '1.0.0'
})

server.server.oninitialized = () => {
  const info = server.server.getClientVersion()
  if (info) {
    setClientInfo({ name: info.name, version: info.version })
  }
}

registerAllTools(server)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// MCP protocol 은 stdout 을 JSON-RPC 채널로 사용 → console.log 절대 금지.
// stderr 직출 (console.error 또는 process.stderr.write) 만 허용.
// eslint-disable-next-line no-console
main().catch((err) => console.error('[mcp-server] fatal:', err))
