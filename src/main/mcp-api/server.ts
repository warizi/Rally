import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { is } from '@electron-toolkit/utils'
import { createRouter } from './router'
import { registerAllRoutes } from './routes'

const socketName = is.dev ? 'mcp-dev.sock' : 'mcp.sock'
const pipeName = is.dev ? 'rally-mcp-dev' : 'rally-mcp'

const socketPath =
  process.platform === 'win32'
    ? `\\\\.\\pipe\\${pipeName}`
    : path.join(os.homedir(), '.rally', socketName)

let server: http.Server | null = null

export function startMcpApiServer(): void {
  if (process.platform !== 'win32') {
    const dir = path.dirname(socketPath)
    fs.mkdirSync(dir, { recursive: true })
  }

  try {
    fs.unlinkSync(socketPath)
  } catch {
    // 파일 없으면 무시
  }

  const router = createRouter()
  registerAllRoutes(router)

  server = http.createServer(router.handle)
  server.listen(socketPath, () => {
    console.log(`[MCP API] Listening on ${socketPath}`)
  })
}

export function stopMcpApiServer(): void {
  if (server) {
    server.close()
    server = null
  }
  try {
    fs.unlinkSync(socketPath)
  } catch {
    // 무시
  }
}
