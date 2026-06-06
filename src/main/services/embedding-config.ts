/**
 * 임베딩 공용 설정. vec0 가상 테이블 차원과 모델이 공유하므로 단일 출처로 분리.
 *
 * 모델 교체 시:
 * - EMBEDDING_MODEL 식별자를 바꾸고
 * - 차원이 달라지면 EMBEDDING_DIM 변경 + vec_embeddings 재생성 + 전체 재임베딩 필요.
 *   (embedding_meta.model 로 구버전 식별)
 */

/** transformers.js 모델 ID (로컬, 오프라인, 한국어 양호) */
export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small'

/** 임베딩 차원 — multilingual-e5-small = 384 */
export const EMBEDDING_DIM = 384

/** sqlite-vec 가상 테이블 이름 */
export const VEC_TABLE = 'vec_embeddings'
