/**
 * 탭 스냅샷 → 세션 store 복원.
 *
 * MainSidebar 의 onRestoreSnapshot 핸들러와 키보드 단축키 hook 양쪽에서
 * 동일 로직을 쓰도록 lib 으로 분리.
 */
import {
  applySessionToStore,
  type SerializedTab,
  type SessionData
} from '@/features/tab-system/manage-tab-system'
import type { TabSnapshot } from '@entities/tab-snapshot'

export function applyTabSnapshot(snapshot: TabSnapshot): void {
  const panes = JSON.parse(snapshot.panesJson) as SessionData['panes']
  const sessionData: SessionData = {
    tabs: JSON.parse(snapshot.tabsJson) as Record<string, SerializedTab>,
    panes,
    layout: JSON.parse(snapshot.layoutJson) as SessionData['layout'],
    activePaneId: Object.keys(panes)[0] ?? ''
  }
  applySessionToStore(sessionData)
}
