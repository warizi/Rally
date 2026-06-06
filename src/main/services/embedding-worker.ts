/**
 * 임베딩 전용 Electron utilityProcess 워커.
 *
 * onnxruntime 추론은 CPU 무거운 동기 네이티브 호출이라 메인 프로세스(메인 스레드)에서
 * 직접 돌리면 이벤트 루프를 막고, 대량 추론(백필) 시 메인 프로세스가 크래시할 수 있다.
 * → 별도 프로세스로 격리: 메인은 안 막히고, onnxruntime가 죽어도 앱은 살아남는다(크래시 격리).
 *
 * 통신: process.parentPort 메시지.
 *   요청  { type:'embed', id, texts, kind }
 *   응답  { id, ok:true, vectors } | { id, ok:false, error }
 *
 * 이 파일은 main 번들과 분리된 별도 엔트리로 빌드된다(electron.vite.config.ts 참고).
 * electron app API는 utilityProcess에서 사용 불가 → 설정값은 env로 전달받는다.
 */
import path from 'path'

const EMBEDDING_MODEL = process.env.EMBED_MODEL || 'Xenova/multilingual-e5-small'
const EMBEDDING_DIM = Number(process.env.EMBED_DIM || '384')
// 한 번의 onnxruntime 추론 배치 상한. 큰 배치는 메모리 할당 abort(SIGTRAP)를 유발하므로
// 청크가 많은 노트도 작은 서브배치로 쪼개 추론한다.
const SUB_BATCH = 4

type FeatureExtractor = (
  texts: string[],
  opts: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist: () => number[][] }>

let extractorPromise: Promise<FeatureExtractor> | null = null

async function getExtractor(): Promise<FeatureExtractor> {
  if (extractorPromise) return extractorPromise
  extractorPromise = (async () => {
    const { pipeline, env } = await import('@xenova/transformers')
    if (process.env.EMBED_CACHE_DIR) {
      env.cacheDir = path.join(process.env.EMBED_CACHE_DIR)
    }
    env.allowLocalModels = false
    return (await pipeline('feature-extraction', EMBEDDING_MODEL)) as unknown as FeatureExtractor
  })()
  return extractorPromise
}

interface EmbedRequest {
  type: 'embed'
  id: number
  texts: string[]
  kind: 'passage' | 'query'
}

// utilityProcess child: process.parentPort 로 메시지 송수신
const parentPort = (
  process as unknown as { parentPort: NodeJS.EventEmitter & { postMessage(m: unknown): void } }
).parentPort

parentPort.on('message', async (e: { data: EmbedRequest }) => {
  const msg = e.data
  if (!msg || msg.type !== 'embed') return
  const { id, texts, kind } = msg
  try {
    const extractor = await getExtractor()
    const prefixed = texts.map((t) => `${kind}: ${t}`)
    // 서브배치로 쪼개 추론 (피크 메모리 제한 → onnxruntime abort 방지)
    const vectors: number[][] = []
    for (let i = 0; i < prefixed.length; i += SUB_BATCH) {
      const slice = prefixed.slice(i, i + SUB_BATCH)
      const output = await extractor(slice, { pooling: 'mean', normalize: true })
      for (const v of output.tolist()) {
        if (v.length !== EMBEDDING_DIM) {
          throw new Error(`embedding dim mismatch: expected ${EMBEDDING_DIM}, got ${v.length}`)
        }
        vectors.push(v)
      }
    }
    parentPort.postMessage({ id, ok: true, vectors })
  } catch (err) {
    parentPort.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
})
