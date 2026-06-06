import { BrowserWindow } from 'electron'

export type EmbeddingProgressKey = 'download' | 'index'

export interface EmbeddingProgress {
  key: EmbeddingProgressKey
  /** 0~100 */
  value: number
  done: boolean
}

/**
 * 임베딩 진행 상태를 모든 렌더러로 push ('embedding:progress').
 * - key 'download': 검색 모델 다운로드
 * - key 'index': 기존 데이터 백필 인덱싱
 */
export function emitEmbeddingProgress(p: EmbeddingProgress): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('embedding:progress', p)
  }
}
