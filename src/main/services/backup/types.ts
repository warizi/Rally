/**
 * 백업 시스템 공개 타입.
 *
 * 다른 모듈(helpers, id-mapper, tab-mapper, serializer, deserializer) 이
 * import 해서 사용. ipc/backup.ts 도 BackupManifest 를 사용.
 */

export interface BackupManifest {
  version: number
  appVersion: string
  workspaceName: string
  exportedAt: string
  tables: string[]
}

/** mapTabJsons 의 반환 — 매핑 완료된 탭 세션 JSON 묶음 */
export interface MappedTabSession {
  tabsJson: string
  panesJson: string
  layoutJson: string
  activePaneId: string
}
