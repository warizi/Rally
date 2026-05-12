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
    // 보안-2: Unix 소켓 파일 권한 0600 (소유자만 r/w) — 같은 사용자가 아닌 프로세스의
    // 접근을 OS 레벨에서 차단. Windows named pipe 는 ACL 모델이라 별도 처리 없음
    // (자세한 내용은 리팩토링 진행 기록/11 [보안-2] Phase 3 노트 참고).
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(socketPath, 0o600)
      } catch (err) {
        console.warn(`[MCP API] failed to chmod socket: ${err}`)
      }
    }
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
