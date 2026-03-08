import http from 'http'
import { ValidationError, PayloadTooLargeError } from '../../lib/errors'

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB

export function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10)
    if (contentLength > MAX_BODY_SIZE) {
      reject(new PayloadTooLargeError())
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    let destroyed = false

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_SIZE) {
        destroyed = true
        req.destroy()
        reject(new PayloadTooLargeError())
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (destroyed) return
      if (size === 0) {
        resolve(null)
        return
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(JSON.parse(raw))
      } catch {
        reject(new ValidationError('Invalid JSON body'))
      }
    })

    req.on('error', (err) => {
      if (!destroyed) reject(err)
    })
  })
}
