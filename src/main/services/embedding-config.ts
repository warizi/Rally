/**
 * 임베딩 공용 설정. vec0 가상 테이블 차원과 모델이 공유하므로 단일 출처로 분리.
 *
 * 모델 교체 시:
 * - EMBEDDING_MODEL 식별자를 바꾸고
 * - 차원이 달라지면 EMBEDDING_DIM 변경 + vec_embeddings 재생성 + 전체 재임베딩 필요.
 *   (embedding_meta.model 로 구버전 식별)
 */

/** transformers.js 모델 ID — **로드 경로**로도 쓰인다 (userData/models/<이 값>/). */
export const EMBEDDING_MODEL = 'Xenova/bge-m3'

/**
 * 임베딩 **신원** — embedding_meta.model 에 저장되며, 값이 바뀌면 startup 이
 * vec 인덱스를 폐기하고 전체 재임베딩한다.
 *
 * EMBEDDING_MODEL 과 분리한 이유: 모델 파일은 그대로인데 **추론 결과가 달라지는**
 * 경우가 있다. @xenova/transformers(onnxruntime 1.14) → @huggingface/transformers
 * (onnxruntime 1.29) 이전에서 같은 모델·같은 입력의 코사인 유사도가 0.988~0.993 으로
 * 측정됐다 — 방향은 보존되지만 동일하지 않다. 구/신 벡터가 한 인덱스에 섞이면
 * 경계선 결과의 랭킹이 흔들리므로, 런타임이 바뀌면 재임베딩한다.
 *
 * 규약: `<모델ID>@<런타임 세대>`. 런타임을 바꿀 때마다 세대를 올린다.
 */
export const EMBEDDING_REVISION = 'Xenova/bge-m3@hf4'

/** transformers.js v3+ 의 dtype 선택 — 배포 모델 파일이 onnx/model_quantized.onnx 라 q8. */
export const EMBEDDING_DTYPE = 'q8'

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
