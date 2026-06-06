import { app, net } from 'electron'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import AdmZip from 'adm-zip'
import { scoped } from '../lib/logger'
import { emitEmbeddingProgress } from '../lib/embedding-progress'
import { EMBEDDING_MODEL, MODEL_DOWNLOAD_URL } from './embedding-config'

const log = scoped('model-bootstrap')

/** userData/models — transformers.js localModelPath 루트 */
export function modelsRoot(): string {
  return path.join(app.getPath('userData'), 'models')
}

/** userData/models/Xenova/bge-m3 */
function modelDir(): string {
  return path.join(modelsRoot(), ...EMBEDDING_MODEL.split('/'))
}

/** 모델 핵심 파일이 모두 있으면 true (다운로드 skip 판단) */
function isModelPresent(): boolean {
  const d = modelDir()
  return (
    fs.existsSync(path.join(d, 'config.json')) &&
    fs.existsSync(path.join(d, 'tokenizer.json')) &&
    fs.existsSync(path.join(d, 'onnx', 'model_quantized.onnx'))
  )
}

async function downloadTo(url: string, dest: string): Promise<void> {
  // electron net.fetch: 시스템 프록시/인증서 적용 (사내망 대응)
  const res = await net.fetch(url)
  if (!res.ok || !res.body) throw new Error(`model download failed: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length') || 0)

  let received = 0
  let lastPct = -1
  const src = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  src.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (total > 0) {
      const pct = Math.floor((received / total) * 100)
      if (pct !== lastPct) {
        lastPct = pct
        emitEmbeddingProgress({ key: 'download', value: pct, done: false })
      }
    }
  })
  await pipeline(src, fs.createWriteStream(dest))
}

let ensurePromise: Promise<void> | null = null

/**
 * 임베딩 모델을 로컬에 보장. 없으면 GitHub Release(zip)에서 받아 userData/models 에 해제.
 * 멱등 + 동시호출 1회로 합침. 실패 시 promise를 비워 다음 호출에서 재시도.
 */
export function ensureModel(): Promise<void> {
  if (ensurePromise) return ensurePromise
  ensurePromise = (async () => {
    if (isModelPresent()) return
    fs.mkdirSync(modelsRoot(), { recursive: true })
    const tmp = path.join(modelsRoot(), `.download-${process.pid}.zip`)
    try {
      log.info(`downloading model: ${MODEL_DOWNLOAD_URL}`)
      emitEmbeddingProgress({ key: 'download', value: 0, done: false })
      await downloadTo(MODEL_DOWNLOAD_URL, tmp)
      log.info('extracting model...')
      // 다운로드 100% 후 압축 해제 단계 (진행률은 100 유지, 완료는 아래에서)
      emitEmbeddingProgress({ key: 'download', value: 100, done: false })
      // zip 루트가 Xenova/bge-m3/... 이므로 modelsRoot 로 풀면 제자리에 위치
      new AdmZip(tmp).extractAllTo(modelsRoot(), true)
      if (!isModelPresent()) throw new Error('model extraction incomplete (missing files)')
      emitEmbeddingProgress({ key: 'download', value: 100, done: true })
      log.info('model ready')
    } catch (err) {
      emitEmbeddingProgress({ key: 'download', value: 0, done: true }) // 실패 시 토스트 닫힘
      throw err
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })().catch((e) => {
    // 실패 시 재시도 가능하도록 캐시 해제 후 전파
    ensurePromise = null
    throw e
  })
  return ensurePromise
}
