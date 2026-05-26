import { BrowserWindow } from 'electron'
import type { Actor } from '../../services/_shared/actor'
import { markRecentWrite } from '../../lib/recent-writes'

export interface BroadcastActor {
  kind: 'user' | 'ai'
  id: string | null
}

function normalizeActor(actor?: Actor | BroadcastActor): BroadcastActor | null {
  if (!actor) return null
  return { kind: actor.kind, id: actor.id ?? null }
}

export function broadcastChanged(
  channel: string,
  wsId: string,
  paths: string[],
  actor?: Actor | BroadcastActor
): void {
  const payload = normalizeActor(actor)
  // 각 path 를 recent-writes 트래커에 등록 → parcelWatcher 가 같은 변경을
  // 비동기로 다시 broadcast 하는 이중 알림을 막는다.
  // 빈 paths (DB-only 채널) 는 등록 대상 아님.
  for (const p of paths) {
    if (p) markRecentWrite(wsId, p)
  }
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, wsId, paths, payload)
  })
}
