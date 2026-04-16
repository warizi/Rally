import type { LayoutNode, Pane } from '@/entities/tab-system'
import type { TabType } from '@/shared/constants/tab-url'
import type { IpcResponse } from '@shared/types/ipc'
import { throwIpcError } from '@shared/lib/ipc-error'

export interface SerializedTab {
  id: string
  type: TabType
  icon?: string
  title: string
  pathname: string
  searchParams?: Record<string, string>
  pinned: boolean
  createdAt: number
  lastAccessedAt: number
  error?: boolean
}

export interface SessionData {
  tabs: Record<string, SerializedTab>
  panes: Record<string, Pane>
  layout: LayoutNode
  activePaneId: string
}

export async function loadSession(workspaceId: string): Promise<SessionData | null> {
  const res = await window.api.tabSession.getByWorkspaceId(workspaceId)

  if (!res.success) {
    if (res.errorType === 'NotFoundError') return null
    throwIpcError(res as IpcResponse)
  }

  if (!res.data) throw new Error('Unexpected: missing data in successful response')
  const session = res.data

  const rawTabs = JSON.parse(session.tabsJson) as Record<string, SerializedTab>
  const tabs = Object.fromEntries(
    Object.entries(rawTabs).map(([k, t]) => [k, { ...t, icon: t.icon ?? t.type }])
  )

  return {
    tabs,
    panes: JSON.parse(session.panesJson) as Record<string, Pane>,
    layout: JSON.parse(session.layoutJson) as LayoutNode,
    activePaneId: session.activePaneId
  }
}

export async function saveSession(workspaceId: string, data: SessionData): Promise<void> {
  const res = await window.api.tabSession.upsert({
    workspaceId,
    tabsJson: JSON.stringify(data.tabs),
    panesJson: JSON.stringify(data.panes),
    layoutJson: JSON.stringify(data.layout),
    activePaneId: data.activePaneId
  })
  if (!res.success) throwIpcError(res as IpcResponse)
}
