/**
 * preload 계약 공용 타입.
 *
 * 도메인별 API 계약 파일(`./note`, `./csv` 등)이 공유하는 응답 envelope 와 actor 타입을
 * 한곳에서 제공한다. `IpcResponse` 는 main 의 응답 envelope(=계약) 이라 re-export 로
 * 중앙화하고, DB row 타입(repositories/*)은 preload 계약에 직접 노출하지 않는다.
 */
export type { IpcResponse } from '../../main/lib/ipc-response'

/** broadcastChanged 가 전달하는 actor 정보 (없으면 null). */
export interface WatcherActor {
  kind: 'user' | 'ai'
  id: string | null
}
