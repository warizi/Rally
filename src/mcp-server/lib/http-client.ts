import http from 'http'
import path from 'path'
import os from 'os'

const isDev = process.env.RALLY_DEV === '1'
const socketName = isDev ? 'mcp-dev.sock' : 'mcp.sock'
const pipeName = isDev ? 'rally-mcp-dev' : 'rally-mcp'

const socketPath =
  process.platform === 'win32'
    ? `\\\\.\\pipe\\${pipeName}`
    : path.join(os.homedir(), '.rally', socketName)

interface HttpResponse {
  status: number
  data: unknown
}

export async function mcpRequest(
  method: string,
  urlPath: string,
  body?: Record<string, unknown>
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    // 보안-2: rally 본체의 MCP API 인증 토큰. mcp-client-config /
    // claude-commands-setup 이 MCP_AUTH_TOKEN 을 자동 주입한다.
    // 누락 시 401 응답 받음 (rally 본체가 거부).
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    const token = process.env.MCP_AUTH_TOKEN
    if (token) {
      headers['x-mcp-token'] = token
    }

    const options: http.RequestOptions = {
      socketPath,
      path: urlPath,
      method,
      headers
    }

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        try {
          const data = JSON.parse(raw)
          resolve({ status: res.statusCode || 200, data })
        } catch {
          resolve({ status: res.statusCode || 200, data: raw })
        }
      })
    })

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
        reject(new Error('Rally 앱이 실행 중이 아닙니다. Rally를 먼저 실행해주세요.'))
      } else {
        reject(err)
      }
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}
