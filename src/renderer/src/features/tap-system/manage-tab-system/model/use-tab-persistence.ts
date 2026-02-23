import { useEffect, useRef } from 'react'
import type { Tab } from '@/entities/tab-system'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTabStore } from './store'
import { loadSession, saveSession } from '../api/queries'
import type { SerializedTab, SessionData } from '../api/queries'

// Query Keys
export const sessionKeys = {
  all: ['session'] as const,
  session: (workspaceId: string) => [...sessionKeys.all, workspaceId] as const
}

// 탭 직렬화 (icon은 type과 동일하므로 저장 생략)
function serializeTab(tab: Tab): SerializedTab {
  return {
    id: tab.id,
    type: tab.type,
    title: tab.title,
    pathname: tab.pathname,
    ...(tab.searchParams && { searchParams: tab.searchParams }),
    pinned: tab.pinned,
    createdAt: tab.createdAt,
    lastAccessedAt: tab.lastAccessedAt,
    ...(tab.error && { error: true })
  }
}

// 직렬화된 탭 복원 (icon = type)
function deserializeTab(serialized: SerializedTab): Tab {
  return {
    id: serialized.id,
    type: serialized.type,
    title: serialized.title,
    icon: serialized.type,
    pathname: serialized.pathname,
    ...(serialized.searchParams && { searchParams: serialized.searchParams }),
    pinned: serialized.pinned,
    createdAt: serialized.createdAt,
    lastAccessedAt: serialized.lastAccessedAt,
    ...(serialized.error && { error: true })
  }
}

// 현재 탭 스토어 상태 → SessionData
function createSaveSessionData(): SessionData {
  const { tabs, panes, layout, activePaneId } = useTabStore.getState()

  const serializedTabs: Record<string, SerializedTab> = {}
  Object.entries(tabs).forEach(([id, tab]) => {
    serializedTabs[id] = serializeTab(tab)
  })

  return { tabs: serializedTabs, panes, layout, activePaneId }
}

// SessionData → 탭 스토어 적용
function applySessionToStore(sessionData: SessionData | null): void {
  if (sessionData) {
    const restoredTabs: Record<string, Tab> = {}
    Object.entries(sessionData.tabs).forEach(([id, serialized]) => {
      restoredTabs[id] = deserializeTab(serialized)
    })
    useTabStore.setState({
      tabs: restoredTabs,
      panes: sessionData.panes,
      layout: sessionData.layout,
      activePaneId: sessionData.activePaneId
    })
  } else {
    useTabStore.getState().reset()
  }
}

// 간단한 선행+후행 스로틀 (lodash 미사용)
interface Throttled {
  (): void
  cancel(): void
  flush(): void
}

function createThrottle(fn: () => void, ms: number): Throttled {
  let lastRun = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const throttled = (): void => {
    const now = Date.now()
    const remaining = ms - (now - lastRun)
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastRun = now
      fn()
    } else if (!timer) {
      timer = setTimeout(() => {
        lastRun = Date.now()
        timer = null
        fn()
      }, remaining)
    }
  }

  throttled.cancel = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  throttled.flush = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    lastRun = Date.now()
    fn()
  }

  return throttled
}

const THROTTLE_MS = 2000

// 모듈 레벨 상태 (React 외부에서 관리)
let currentWsId: string | null = null
let initialized = false

function flushSession(wsId: string): void {
  const data = createSaveSessionData()
  saveSession(wsId, data).catch((err) => console.error('Failed to flush session:', err))
}

const throttledSave = createThrottle(() => {
  if (currentWsId && initialized) {
    flushSession(currentWsId)
  }
}, THROTTLE_MS)

export function useSessionPersistence(): void {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const prevWorkspaceIdRef = useRef<string | null>(null)

  // 모듈 레벨 상태 동기화
  useEffect(() => {
    currentWsId = workspaceId
  }, [workspaceId])

  // 워크스페이스 전환: 이전 세션 저장 → 새 세션 로드
  useEffect(() => {
    if (!workspaceId) return

    const prevId = prevWorkspaceIdRef.current

    const handleSwitch = async (): Promise<void> => {
      // 이전 워크스페이스 세션 저장
      if (prevId && prevId !== workspaceId && initialized) {
        throttledSave.cancel()
        flushSession(prevId)
      }

      // 새 워크스페이스 세션 로드
      try {
        const sessionData = await loadSession(workspaceId)
        applySessionToStore(sessionData)
      } catch (err) {
        console.error('Failed to load session:', err)
        useTabStore.getState().reset()
      }

      prevWorkspaceIdRef.current = workspaceId
      initialized = true
    }

    handleSwitch()
  }, [workspaceId])

  // 탭 스토어 변경 구독 → throttle 저장
  useEffect(() => {
    const unsubscribe = useTabStore.subscribe(() => {
      throttledSave()
    })

    const handleBeforeUnload = (): void => {
      throttledSave.flush()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      throttledSave.flush()
    }
  }, [])
}
