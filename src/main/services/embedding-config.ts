/**
 * 임베딩 공용 설정. vec0 가상 테이블 차원과 모델이 공유하므로 단일 출처로 분리.
 *
 * 모델 교체 시:
 * - EMBEDDING_MODEL 식별자를 바꾸고
 * - 차원이 달라지면 EMBEDDING_DIM 변경 + vec_embeddings 재생성 + 전체 재임베딩 필요.
 *   (embedding_meta.model 로 구버전 식별)
 */

/** transformers.js 모델 ID (로컬, 오프라인, 다국어/한국어 의미 분리도 우수) */
export const EMBEDDING_MODEL = 'Xenova/bge-m3'

/** 임베딩 차원 — bge-m3 = 1024 */
export const EMBEDDING_DIM = 1024

/** sqlite-vec 가상 테이블 이름 */
export const VEC_TABLE = 'vec_embeddings'

/**
 * 모델 자체 호스팅 URL (GitHub Release 자산). HF 비의존.
 * zip 루트는 `Xenova/bge-m3/...` 구조여야 하며, 첫 실행 시 userData/models 로 받아 압축 해제.
 * RALLY_MODEL_URL 환경변수로 오버라이드 가능(테스트/대체 호스트).
 */
export const MODEL_DOWNLOAD_URL =
  process.env.RALLY_MODEL_URL ||
  'https://github.com/warizi/Rally/releases/download/models/bge-m3.zip'
