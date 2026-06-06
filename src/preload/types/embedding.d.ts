export interface EmbeddingProgress {
  /** 'download' = 검색 모델 다운로드, 'index' = 기존 데이터 백필 인덱싱 */
  key: 'download' | 'index'
  /** 0~100 */
  value: number
  done: boolean
}

export interface EmbeddingAPI {
  onProgress: (callback: (data: EmbeddingProgress) => void) => () => void
}
