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

main().catch(console.error)
