import http from 'http'
import path from 'path'
import os from 'os'

const socketPath =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\rally-mcp'
    : path.join(os.homedir(), '.rally', 'mcp.sock')

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
    const options: http.RequestOptions = {
      socketPath,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
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
