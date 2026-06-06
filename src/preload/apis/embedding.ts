import { ipcRenderer } from 'electron'

interface EmbeddingProgress {
  key: 'download' | 'index'
  value: number
  done: boolean
}

export const embeddingApi = {
  /** 임베딩 진행(모델 다운로드 / 백필 인덱싱) push 구독. 반환값 호출로 해제. */
  onProgress: (callback: (data: EmbeddingProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: EmbeddingProgress): void => callback(data)
    ipcRenderer.on('embedding:progress', handler)
    return () => ipcRenderer.removeListener('embedding:progress', handler)
  }
}
