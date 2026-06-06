import { app, utilityProcess, type UtilityProcess } from 'electron'
import path from 'path'
import { scoped } from '../lib/logger'
import { EMBEDDING_MODEL, EMBEDDING_DIM } from './embedding-config'

const log = scoped('embedding-model')

export type EmbedKind = 'passage' | 'query'

// 추론은 utilityProcess(별도 프로세스)에서 실행 — 메인 스레드 블로킹/크래시 격리.
let child: UtilityProcess | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>()

const REQUEST_TIMEOUT_MS = 120_000

function workerPath(): string {
  // main 번들과 함께 out/main/embedding-worker.js 로 빌드됨 (dev/prod 모두 __dirname 기준).
  return path.join(__dirname, 'embedding-worker.js')
}

function ensureChild(): UtilityProcess {
  if (child) return child
  const c = utilityProcess.fork(workerPath(), [], {
    serviceName: 'rally-embedding',
    env: {
      ...process.env,
      EMBED_MODEL: EMBEDDING_MODEL,
      EMBED_DIM: String(EMBEDDING_DIM),
      EMBED_CACHE_DIR: path.join(app.getPath('userData'), 'models')
    }
  })
  log.info('embedding worker spawned')

  c.on('message', (msg: { id: number; ok: boolean; vectors?: number[][]; error?: string }) => {
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok && msg.vectors) p.resolve(msg.vectors)
    else p.reject(new Error(msg.error || 'embedding failed'))
  })

  c.on('exit', (code) => {
    log.warn(`embedding worker exited (code ${code})`)
    for (const [, p] of pending) p.reject(new Error('embedding worker exited'))
    pending.clear()
    child = null
  })

  child = c
  return c
}

/**
 * 텍스트 배열을 384차원 벡터로 임베딩 (utilityProcess에 위임).
 * mean pooling + L2 정규화 + e5 접두사는 워커가 처리한다.
 */
export async function embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
  if (texts.length === 0) return []
  const c = ensureChild()
  const id = nextId++
  return new Promise<number[][]>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error('embedding request timed out'))
    }, REQUEST_TIMEOUT_MS)
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      }
    })
    c.postMessage({ type: 'embed', id, texts, kind })
  })
}

/** 단일 텍스트 임베딩 편의 함수. */
export async function embedOne(text: string, kind: EmbedKind): Promise<number[]> {
  const [v] = await embed([text], kind)
  return v
}

/** 워커 사전 기동(워밍업). */
export async function warmup(): Promise<void> {
  ensureChild()
}
