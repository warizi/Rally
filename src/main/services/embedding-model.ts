import path from 'path'
import { scoped } from '../lib/logger'
import { EMBEDDING_MODEL, EMBEDDING_DIM } from './embedding-config'

const log = scoped('embedding-model')

export type EmbedKind = 'passage' | 'query'

// transformers.js는 ESM 전용이라 동적 import로 로드 (CJS/ESM interop 회피).
// 타입은 런타임 의존성을 피하기 위해 최소한으로만 선언.
type FeatureExtractor = (
  texts: string[],
  opts: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist: () => number[][] }>

let extractorPromise: Promise<FeatureExtractor> | null = null

async function getExtractor(): Promise<FeatureExtractor> {
  if (extractorPromise) return extractorPromise
  extractorPromise = (async () => {
    const { app } = await import('electron')
    const { pipeline, env } = await import('@xenova/transformers')
    // 모델 캐시를 userData 하위로 고정 (프로덕션에서 읽기전용 asar 회피).
    env.cacheDir = path.join(app.getPath('userData'), 'models')
    env.allowLocalModels = false
    log.info(`loading model ${EMBEDDING_MODEL} (cacheDir=${env.cacheDir})`)
    const extractor = (await pipeline(
      'feature-extraction',
      EMBEDDING_MODEL
    )) as unknown as FeatureExtractor
    log.info('model loaded')
    return extractor
  })()
  return extractorPromise
}

/** e5 접두사 규칙: 문서는 "passage: ", 쿼리는 "query: " */
function withPrefix(text: string, kind: EmbedKind): string {
  return `${kind}: ${text}`
}

/**
 * 텍스트 배열을 384차원 벡터로 임베딩. mean pooling + L2 정규화 적용.
 * e5 규칙에 따라 kind별 접두사를 자동 부착한다.
 */
export async function embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
  if (texts.length === 0) return []
  const extractor = await getExtractor()
  const prefixed = texts.map((t) => withPrefix(t, kind))
  const output = await extractor(prefixed, { pooling: 'mean', normalize: true })
  const vectors = output.tolist()
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIM) {
      throw new Error(`embedding dim mismatch: expected ${EMBEDDING_DIM}, got ${v.length}`)
    }
  }
  return vectors
}

/** 단일 텍스트 임베딩 편의 함수. */
export async function embedOne(text: string, kind: EmbedKind): Promise<number[]> {
  const [v] = await embed([text], kind)
  return v
}

/** 모델 사전 로딩(워밍업). 백필/검색 전 한 번 호출하면 첫 지연을 줄인다. */
export async function warmup(): Promise<void> {
  await getExtractor()
}
