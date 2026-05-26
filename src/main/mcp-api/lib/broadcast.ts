import { BrowserWindow } from 'electron'
import type { Actor } from '../../services/_shared/actor'

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
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, wsId, paths, payload)
  })
}
